import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { createServerAnonClient, ServerConfigurationError } from "@/lib/server-supabase";

const deviceCookie = "bta_social_device";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SocialActor = {
  userId: string | null;
  deviceId: string | null;
  existingDeviceId: string | null;
  deviceHash: string | null;
  actorKey: string;
  secret: string;
};

export async function getSocialActor(request: NextRequest): Promise<SocialActor> {
  const secret = (process.env.SOCIAL_DISCOVERY_HASH_SECRET || process.env.TRAVELER_REPORT_HASH_SECRET || "").trim();
  if (secret.length < 32) throw new ServerConfigurationError("Social discovery hash secret is missing.");

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  let userId: string | null = null;
  if (token) {
    const client = createServerAnonClient(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new SocialActorError("invalid_session");
    userId = data.user.id;
  }

  const cookieValue = request.cookies.get(deviceCookie)?.value ?? null;
  const existingDeviceId = cookieValue && uuidPattern.test(cookieValue) ? cookieValue : null;
  const deviceId = userId ? null : existingDeviceId ?? randomUUID();
  const deviceHash = deviceId ? createHmac("sha256", secret).update(deviceId).digest("hex") : null;
  return {
    userId,
    deviceId,
    existingDeviceId,
    deviceHash,
    actorKey: userId ?? deviceHash as string,
    secret,
  };
}

export function setSocialDeviceCookie(response: NextResponse, actor: SocialActor) {
  if (!actor.deviceId || actor.deviceId === actor.existingDeviceId) return;
  response.cookies.set(deviceCookie, actor.deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    priority: "medium",
  });
}

export function signSocialConfirmation(mappingId: string, actor: SocialActor) {
  return createHmac("sha256", actor.secret).update(`${mappingId}:${actor.actorKey}`).digest("hex");
}

export function verifySocialConfirmation(mappingId: string, token: string, actor: SocialActor) {
  const expected = signSocialConfirmation(mappingId, actor);
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}

export function isSameRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.nextUrl.host;
    return originUrl.host === forwardedHost;
  } catch {
    return false;
  }
}

export class SocialActorError extends Error {}
