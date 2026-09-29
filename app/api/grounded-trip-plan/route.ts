import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildGroundedTripPlan, GroundedTripInputError, normalizeGroundedTripRequest, rankGroundedCandidates } from "@/lib/grounded-trip-planner";
import { isGroundedTripAiEnabled, orderGroundedTripCandidates } from "@/lib/grounded-trip-ai";
import { applyGroundedTripRateLimit, getGroundedTripActor, GroundedTripActorError, isSameOrigin, setGroundedTripDeviceCookie } from "@/lib/grounded-trip-server";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { createServerServiceClient } from "@/lib/server-supabase";
import type { GroundedTripPlan } from "@/types/grounded-trip";
import { isGroundedTripPlannerEnabled, isItineraryRecoveryEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRequestBytes = 24_000;
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const responseCache = new Map<string, { expiresAt: number; plan: GroundedTripPlan }>();

export async function POST(request: NextRequest) {
  if (!isGroundedTripPlannerEnabled()) return json({ message: "feature_disabled" }, 404);
  const startedAt = Date.now();
  if (!isSameOrigin(request)) return json({ message: "cross_site_blocked" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ message: "json_required" }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > maxRequestBytes) return json({ message: "request_too_large" }, 413);

  let logId = "";
  let service: ReturnType<typeof createServerServiceClient> | null = null;
  try {
    const actor = await getGroundedTripActor(request);
    applyGroundedTripRateLimit(actor.actorKey);
    const body = await request.json();
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > maxRequestBytes) return json({ message: "request_too_large" }, 413);
    const normalized = normalizeGroundedTripRequest(body);
    if (normalized.mode === "recover" && !isItineraryRecoveryEnabled()) return json({ message: "feature_disabled" }, 404);
    const fingerprint = createHash("sha256").update(JSON.stringify({ mode: normalized.mode, conditions: normalized.conditions, existing: normalized.existing_itinerary })).digest("hex");

    try {
      service = createServerServiceClient();
      if (actor.userId || actor.deviceHash) {
        const registration = await service.rpc("register_grounded_trip_plan_request", {
          actor_user_id: actor.userId,
          actor_device_hash: actor.deviceHash,
          request_kind: normalized.mode,
          request_condition_hash: fingerprint,
          request_locale: normalized.conditions.language,
        });
        if (registration.error?.code === "P0001") return json({ message: "rate_limited" }, 429);
        if (!registration.error) logId = String(registration.data ?? "");
      }
    } catch {
      service = null;
    }

    const cached = responseCache.get(fingerprint);
    if (cached && cached.expiresAt > Date.now()) {
      await finishLog(service, logId, cached.plan, "cache", startedAt, 0, 0, null);
      const response = NextResponse.json({ plan: cached.plan, ai_status: "cached" }, { headers });
      setGroundedTripDeviceCookie(response, actor);
      return response;
    }

    const { places, error } = await getCachedPublicPlaces(normalized.conditions.language, normalized.conditions.current_location.city_code);
    if (error && !places.length) throw new Error("places_unavailable");
    const ranked = rankGroundedCandidates(places, normalized.conditions).slice(0, 12);
    let source: "rules" | "ai_ordered" = "rules";
    let aiStatus: "disabled" | "completed" | "fallback" = "disabled";
    let preferredOrderIds: string[] | undefined;
    let model: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    if (isGroundedTripAiEnabled() && ranked.length) {
      try {
        const ai = await orderGroundedTripCandidates({ conditions: normalized.conditions, candidates: ranked.map((item) => item.place) });
        preferredOrderIds = ai.orderedPlaceIds;
        source = "ai_ordered";
        aiStatus = "completed";
        model = ai.model;
        inputTokens = ai.inputTokens;
        outputTokens = ai.outputTokens;
      } catch {
        aiStatus = "fallback";
      }
    }

    const plan = buildGroundedTripPlan({
      places,
      conditions: normalized.conditions,
      preferredOrderIds,
      source,
      existingItinerary: normalized.mode === "recover" ? normalized.existing_itinerary : [],
    });
    responseCache.set(fingerprint, { expiresAt: Date.now() + 2 * 60 * 1000, plan });
    pruneCache();
    await finishLog(service, logId, plan, aiStatus, startedAt, inputTokens, outputTokens, model);
    const response = NextResponse.json({ plan, ai_status: aiStatus }, { headers });
    setGroundedTripDeviceCookie(response, actor);
    return response;
  } catch (error) {
    if (service && logId) await service.from("grounded_trip_plan_requests").update({ result_status: "failed", duration_ms: Date.now() - startedAt }).eq("id", logId);
    if (error instanceof GroundedTripActorError) return json({ message: error.message }, error.message === "rate_limited" ? 429 : 401);
    if (error instanceof GroundedTripInputError || error instanceof SyntaxError) return json({ message: "invalid_input" }, 400);
    return json({ message: error instanceof Error && error.message === "places_unavailable" ? "places_unavailable" : "planning_failed" }, 500);
  }
}

async function finishLog(service: ReturnType<typeof createServerServiceClient> | null, id: string, plan: GroundedTripPlan, aiStatus: string, startedAt: number, inputTokens: number, outputTokens: number, model: string | null) {
  if (!service || !id) return;
  await service.from("grounded_trip_plan_requests").update({
    result_status: plan.places.length ? "completed" : "no_result",
    planner_source: plan.source,
    ai_status: aiStatus,
    model_name: model,
    candidate_count: plan.places.length,
    result_place_count: plan.places.length,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: Date.now() - startedAt,
  }).eq("id", id);
}

function pruneCache() {
  if (responseCache.size <= 200) return;
  const now = Date.now();
  for (const [key, value] of responseCache) if (value.expiresAt <= now) responseCache.delete(key);
  while (responseCache.size > 200) responseCache.delete(responseCache.keys().next().value as string);
}

function json(body: Record<string, unknown>, status: number) { return NextResponse.json(body, { status, headers }); }
