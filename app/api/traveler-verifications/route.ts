import { createHmac, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerAnonClient, createServerServiceClient, ServerConfigurationError } from "@/lib/server-supabase";
import {
  emptyTravelerTrustSummary,
  parseTravelerVerificationPayload,
  TravelerVerificationInputError,
  type TravelerTrustSummary,
} from "@/lib/traveler-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deviceCookie = "bta_traveler_device";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId") ?? "";
  if (!uuidPattern.test(placeId)) return NextResponse.json({ message: "Invalid place ID." }, { status: 400 });

  try {
    const client = createServerAnonClient();
    const { data, error } = await client.rpc("get_place_trust_summary", { target_place_id: placeId });
    if (error) {
      if (isMissingTravelerSchema(error)) return NextResponse.json({ summary: emptyTravelerTrustSummary() }, { headers: noStoreHeaders });
      throw error;
    }
    return NextResponse.json({ summary: normalizeSummary(data) }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ summary: emptyTravelerTrustSummary() }, { headers: noStoreHeaders });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ message: "Cross-site submissions are not allowed." }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ message: "JSON request required." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return NextResponse.json({ message: "Request body is too large." }, { status: 413 });

  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) return NextResponse.json({ message: "Request body is too large." }, { status: 413 });
    const payload = parseTravelerVerificationPayload(JSON.parse(rawBody));
    const userId = await getOptionalUserId(request);
    const hashSecret = process.env.TRAVELER_REPORT_HASH_SECRET?.trim();
    if (!hashSecret || hashSecret.length < 32) throw new ServerConfigurationError("Traveler verification hash secret is missing.");

    const existingDeviceId = request.cookies.get(deviceCookie)?.value;
    const anonymousDeviceId = userId ? null : validDeviceId(existingDeviceId) ? existingDeviceId as string : randomUUID();
    const deviceHash = anonymousDeviceId ? createHmac("sha256", hashSecret).update(anonymousDeviceId).digest("hex") : null;
    const method = payload.nearbyConfirmed ? "location" : userId ? "authenticated" : "manual";
    const service = createServerServiceClient();
    const { data, error } = await service.rpc("submit_traveler_verification", {
      target_place_id: payload.placeId,
      actor_user_id: userId,
      actor_device_hash: deviceHash,
      actor_locale: payload.locale,
      actor_verification_method: method,
      facts: payload.facts,
    });
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ message: "rate_limited" }, { status: 429 });
      if (isMissingTravelerSchema(error)) return NextResponse.json({ message: "verification_not_configured" }, { status: 503 });
      throw error;
    }

    const response = NextResponse.json({ result: data }, { status: 201, headers: noStoreHeaders });
    if (anonymousDeviceId && anonymousDeviceId !== existingDeviceId) {
      response.cookies.set(deviceCookie, anonymousDeviceId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        priority: "medium",
      });
    }
    return response;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TravelerVerificationInputError) {
      return NextResponse.json({ message: "invalid_submission" }, { status: 400 });
    }
    if (error instanceof ServerConfigurationError) {
      return NextResponse.json({ message: "verification_not_configured" }, { status: 503 });
    }
    return NextResponse.json({ message: "verification_failed" }, { status: 500 });
  }
}

async function getOptionalUserId(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const client = createServerAnonClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new TravelerVerificationInputError("Invalid session.");
  return data.user.id;
}

function isSameOrigin(request: NextRequest) {
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

function validDeviceId(value: string | undefined) {
  return Boolean(value && uuidPattern.test(value));
}

function isMissingTravelerSchema(error: { code?: string; message?: string }) {
  return ["42P01", "42703", "42883", "PGRST202"].includes(error.code ?? "")
    || error.message?.includes("get_place_trust_summary") === true
    || error.message?.includes("submit_traveler_verification") === true;
}

function normalizeSummary(value: unknown): TravelerTrustSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyTravelerTrustSummary();
  return { ...emptyTravelerTrustSummary(), ...(value as Partial<TravelerTrustSummary>), facts: Array.isArray((value as Partial<TravelerTrustSummary>).facts) ? (value as TravelerTrustSummary).facts : [] };
}

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };
