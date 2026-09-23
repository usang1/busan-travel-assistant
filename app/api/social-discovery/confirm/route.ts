import { NextRequest, NextResponse } from "next/server";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { createServerServiceClient, ServerConfigurationError } from "@/lib/server-supabase";
import {
  getSocialActor,
  isSameRequestOrigin,
  SocialActorError,
  verifySocialConfirmation,
} from "@/lib/social-discovery-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashPattern = /^[a-f0-9]{64}$/;
const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  if (!isSameRequestOrigin(request)) return json("cross_site_blocked", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json("json_required", 415);

  try {
    const body = await request.json() as { mappingId?: string; placeId?: string; token?: string };
    const mappingId = body.mappingId ?? "";
    const placeId = body.placeId ?? "";
    const token = body.token ?? "";
    if (!uuidPattern.test(mappingId) || !uuidPattern.test(placeId) || !hashPattern.test(token)) return json("invalid_confirmation", 400);

    const actor = await getSocialActor(request);
    if (!verifySocialConfirmation(mappingId, token, actor)) return json("invalid_confirmation", 403);
    const service = createServerServiceClient();
    const { data: mapping, error: mappingError } = await service
      .from("sns_place_mappings")
      .select("id, created_by, created_by_device_hash")
      .eq("id", mappingId)
      .maybeSingle();
    if (mappingError || !mapping) return json("mapping_not_found", 404);
    const ownsMapping = actor.userId
      ? mapping.created_by === actor.userId
      : Boolean(actor.deviceHash && mapping.created_by_device_hash === actor.deviceHash);
    if (!ownsMapping) return json("invalid_confirmation", 403);

    const { data: candidate, error: candidateError } = await service
      .from("sns_place_candidates")
      .select("place_id")
      .eq("mapping_id", mappingId)
      .eq("place_id", placeId)
      .maybeSingle();
    if (candidateError || !candidate) return json("candidate_not_found", 404);
    const { places } = await getCachedPublicPlaces("ko", "busan");
    if (!places.some((place) => place.id === placeId)) return json("place_not_public", 409);

    const clear = await service.from("sns_place_candidates").update({ confirmed_by_user: false }).eq("mapping_id", mappingId);
    if (clear.error) throw clear.error;
    const selected = await service.from("sns_place_candidates").update({ confirmed_by_user: true }).eq("mapping_id", mappingId).eq("place_id", placeId);
    if (selected.error) throw selected.error;
    const updated = await service.from("sns_place_mappings").update({
      confirmed_place_id: placeId,
      confirmed_by_user_at: new Date().toISOString(),
      moderation_status: "needs_review",
    }).eq("id", mappingId);
    if (updated.error) throw updated.error;
    return NextResponse.json({ confirmed: true }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof SocialActorError) return json(error.message, 401);
    if (error instanceof ServerConfigurationError) return json("social_discovery_not_configured", 503);
    return json(isMissingSchema(error) ? "social_discovery_migration_required" : "confirmation_failed", isMissingSchema(error) ? 503 : 500);
  }
}

function isMissingSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string };
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(value.code ?? "");
}

function json(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStoreHeaders });
}
