import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  analyticsDedupeWindowSeconds,
  analyticsDeviceType,
  canonicalEventName,
  isAnalyticsEventName,
  legacyCompatibleEventName,
  safeAnalyticsDimension,
  safeAnalyticsPath,
  sanitizeAnalyticsMetadata,
} from "@/lib/analytics-schema";
import { createServerAnonClient, createServerServiceClient } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

type EventBody = {
  eventId?: unknown; eventName?: unknown; placeId?: unknown; anonymousSessionId?: unknown;
  sourcePage?: unknown; referrer?: unknown; campaignId?: unknown; locale?: unknown;
  deviceType?: unknown; metadata?: unknown;
};

const limits = new Map<string, { count: number; resetAt: number }>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const locales = new Set(["ko", "zh", "en", "ja"]);

export async function POST(request: Request) {
  try {
    if (looksLikeBot(request.headers.get("user-agent") || "")) return new NextResponse(null, { status: 202 });
    const body = await request.json().catch(() => null) as EventBody | null;
    if (!body || !isAnalyticsEventName(body.eventName)) return jsonError("지원하지 않는 분석 이벤트입니다.", 400);
    if (!isUuid(body.eventId) || !isSessionId(body.anonymousSessionId)) return jsonError("이벤트 또는 익명 세션 식별자가 올바르지 않습니다.", 400);
    if (body.placeId !== undefined && body.placeId !== null && !isUuid(body.placeId)) return jsonError("장소 식별자가 올바르지 않습니다.", 400);

    const user = await optionalUser(request);
    const sessionId = String(body.anonymousSessionId);
    enforceRateLimit(user?.id || sessionId);
    const eventName = canonicalEventName(body.eventName);
    const sourcePage = safeAnalyticsPath(body.sourcePage) || "/";
    const locale = typeof body.locale === "string" && locales.has(body.locale) ? body.locale : "ko";
    const deviceType = analyticsDeviceType(body.deviceType, request.headers.get("user-agent") || "");
    const referrerHost = normalizeReferrer(body.referrer);
    const campaignId = safeAnalyticsDimension(body.campaignId, 80) || null;
    const metadata = sanitizeAnalyticsMetadata(isRecord(body.metadata) ? body.metadata : {});
    const channel = safeAnalyticsDimension(metadata.channel, 40) || null;
    const source = safeAnalyticsDimension(metadata.initial_source, 80) || null;
    const dedupeKey = createDedupeKey({ eventName, sessionId, placeId: body.placeId, sourcePage, metadata });
    const client = createServerServiceClient();
    const row = {
      id: body.eventId,
      client_event_id: body.eventId,
      event_type: eventName,
      user_id: user?.id ?? null,
      place_id: body.placeId ?? null,
      locale,
      anonymous_session_id: sessionId,
      occurred_at: new Date().toISOString(),
      source_page: sourcePage,
      referrer_host: referrerHost,
      campaign_id: campaignId,
      device_type: deviceType,
      channel,
      source,
      dedupe_key: dedupeKey,
      metadata,
    };
    const { error } = dedupeKey
      ? await client.from("place_action_events").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
      : await client.from("place_action_events").insert(row);
    if (error && error.code !== "23505") {
      if (!["42703", "PGRST204", "PGRST205", "22P02"].includes(error.code || "")) throw error;
      const legacyEventName = legacyCompatibleEventName(body.eventName);
      if (legacyEventName) {
        const legacy = await client.from("place_action_events").insert({
          id: body.eventId,
          event_type: legacyEventName,
          user_id: user?.id ?? null,
          place_id: body.placeId ?? null,
          locale,
          metadata: { ...metadata, visit_id: sessionId, device_type: deviceType, source_page: sourcePage },
        });
        if (legacy.error && legacy.error.code !== "23505") throw legacy.error;
      }
    }
    return new NextResponse(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? Number((error as { status: number }).status) : 503;
    return jsonError(status === 429 ? "분석 이벤트 요청이 너무 많습니다." : "분석 이벤트를 저장하지 못했습니다.", status);
  }
}

async function optionalUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1];
  if (!token) return null;
  const { data } = await createServerAnonClient(token).auth.getUser(token);
  return data.user ?? null;
}

function createDedupeKey(input: { eventName: string; sessionId: string; placeId: unknown; sourcePage: string; metadata: Record<string, unknown> }) {
  const windowSeconds = analyticsDedupeWindowSeconds(input.eventName);
  if (!windowSeconds) return null;
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const discriminator = input.eventName === "filter_apply" ? `${input.metadata.filter_kind || ""}:${input.metadata.filter_value || ""}` : "";
  return createHash("sha256").update([input.sessionId, input.eventName, input.placeId || "", input.sourcePage, discriminator, bucket].join("|")).digest("hex");
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  if (limits.size > 10_000) {
    for (const [entryKey, entry] of limits) if (entry.resetAt <= now) limits.delete(entryKey);
  }
  const current = limits.get(key);
  if (!current || current.resetAt <= now) return void limits.set(key, { count: 1, resetAt: now + 60_000 });
  if (current.count >= 120) throw Object.assign(new Error("rate_limited"), { status: 429 });
  current.count += 1;
}

function normalizeReferrer(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try { return new URL(value).hostname.slice(0, 120) || null; } catch { return safeAnalyticsDimension(value, 120) || null; }
}
function looksLikeBot(value: string) { return /bot|crawler|spider|headless|lighthouse|pagespeed|preview/i.test(value); }
function isUuid(value: unknown): value is string { return typeof value === "string" && uuidPattern.test(value); }
function isSessionId(value: unknown): value is string { return typeof value === "string" && (uuidPattern.test(value) || /^visit-[a-z0-9-]{8,100}$/iu.test(value)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function jsonError(message: string, status: number) { return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } }); }
