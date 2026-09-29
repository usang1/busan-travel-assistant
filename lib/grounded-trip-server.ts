import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { createServerAnonClient } from "@/lib/server-supabase";

const cookieName = "bta_trip_planner_device";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const processSalt = randomBytes(32).toString("hex");
const rateBuckets = new Map<string, number[]>();

export type GroundedTripActor = {
  userId: string | null;
  deviceId: string | null;
  existingDeviceId: string | null;
  deviceHash: string | null;
  actorKey: string;
};

export class GroundedTripActorError extends Error {}

export async function getGroundedTripActor(request: NextRequest): Promise<GroundedTripActor> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  let userId: string | null = null;
  if (token) {
    const client = createServerAnonClient(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new GroundedTripActorError("invalid_session");
    userId = data.user.id;
  }
  const cookieValue = request.cookies.get(cookieName)?.value ?? null;
  const existingDeviceId = cookieValue && uuidPattern.test(cookieValue) ? cookieValue : null;
  const deviceId = userId ? null : existingDeviceId ?? randomUUID();
  const secret = (process.env.TRIP_PLANNER_HASH_SECRET || process.env.SOCIAL_DISCOVERY_HASH_SECRET || process.env.TRAVELER_REPORT_HASH_SECRET || "").trim();
  const deviceHash = deviceId && secret.length >= 32 ? createHmac("sha256", secret).update(deviceId).digest("hex") : null;
  const actorKey = userId ?? deviceHash ?? createHmac("sha256", processSalt).update(deviceId as string).digest("hex");
  return { userId, deviceId, existingDeviceId, deviceHash, actorKey };
}

export function applyGroundedTripRateLimit(actorKey: string, now = Date.now()) {
  const recent = (rateBuckets.get(actorKey) ?? []).filter((time) => time > now - 60 * 60 * 1000);
  if (recent.length >= 10) throw new GroundedTripActorError("rate_limited");
  recent.push(now);
  rateBuckets.set(actorKey, recent);
  if (rateBuckets.size > 5000) {
    for (const [key, times] of rateBuckets) if (!times.some((time) => time > now - 60 * 60 * 1000)) rateBuckets.delete(key);
  }
}

export function setGroundedTripDeviceCookie(response: NextResponse, actor: GroundedTripActor) {
  if (!actor.deviceId || actor.deviceId === actor.existingDeviceId) return;
  response.cookies.set(cookieName, actor.deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    priority: "medium",
  });
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.nextUrl.host);
  } catch {
    return false;
  }
}

