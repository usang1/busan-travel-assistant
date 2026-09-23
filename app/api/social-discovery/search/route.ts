import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isLocale, type Locale } from "@/lib/i18n";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { createServerServiceClient, ServerConfigurationError } from "@/lib/server-supabase";
import {
  emptySocialClues,
  extractSocialClues,
  findSocialUrl,
  matchSocialPlaces,
  mergeSocialClues,
  normalizePublicSocialUrl,
  socialClueSummary,
  socialInputKinds,
  SocialDiscoveryInputError,
  type ApprovedSocialAlias,
  type SocialInputKind,
  type SocialPlatform,
} from "@/lib/social-discovery";
import { extractSocialImageClues, SocialImageError } from "@/lib/social-discovery-ocr";
import {
  getSocialActor,
  isSameRequestOrigin,
  setSocialDeviceCookie,
  signSocialConfirmation,
  SocialActorError,
} from "@/lib/social-discovery-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxRequestBytes = 5 * 1024 * 1024;
const maxTextLength = 6000;
const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(request: NextRequest) {
  if (!isSameRequestOrigin(request)) return json({ message: "cross_site_blocked" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return json({ message: "multipart_required" }, 415);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) return json({ message: "request_too_large" }, 413);

  let requestId = "";
  let service: ReturnType<typeof createServerServiceClient> | null = null;
  try {
    const form = await request.formData();
    const inputKind = String(form.get("inputKind") ?? "text") as SocialInputKind;
    const localeValue = String(form.get("locale") ?? "zh");
    const inputText = String(form.get("inputText") ?? "").normalize("NFKC").trim();
    const fileValue = form.get("image");
    const image = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

    if (!socialInputKinds.includes(inputKind) || !isLocale(localeValue)) return json({ message: "invalid_input" }, 400);
    if (inputText.length > maxTextLength) return json({ message: "text_too_large" }, 413);
    if (inputKind === "image" && !image) return json({ message: "image_required" }, 400);
    if (inputKind !== "image" && !inputText) return json({ message: "text_required" }, 400);

    const socialUrl = inputKind === "link" ? normalizePublicSocialUrl(inputText) : findSocialUrl(inputText);
    if (inputKind === "link" && !socialUrl) return json({ message: "invalid_social_link" }, 400);
    const platform: SocialPlatform = socialUrl?.platform ?? "other";
    const actor = await getSocialActor(request);
    service = createServerServiceClient();
    const registered = await service.rpc("register_social_discovery_request", {
      actor_user_id: actor.userId,
      actor_device_hash: actor.deviceHash,
      request_input_kind: inputKind,
      request_source_platform: platform,
      request_uses_ocr: Boolean(image),
    });
    if (registered.error) {
      if (registered.error.code === "P0001") return json({ message: "rate_limited" }, 429);
      throw schemaError(registered.error);
    }
    requestId = String(registered.data ?? "");

    let clues = inputText ? extractSocialClues(inputText) : emptySocialClues();
    let ocrStatus: "not_used" | "completed" = "not_used";
    if (image) {
      try {
        clues = mergeSocialClues(clues, await extractSocialImageClues(image));
        ocrStatus = "completed";
      } catch (error) {
        const status = error instanceof SocialImageError ? error.code : "ocr_failed";
        await markRequest(service, requestId, status === "ocr_unavailable" ? "ocr_unavailable" : "ocr_failed");
        return json({ message: status }, status === "ocr_unavailable" ? 503 : 422);
      }
    }

    const fingerprint = socialUrl?.normalizedUrl || socialClueSummary(clues).join("|") || inputText.slice(0, 500) || `empty:${requestId}`;
    const sourceHash = createHash("sha256").update(fingerprint).digest("hex");
    const { places } = await getCachedPublicPlaces(localeValue as Locale, "busan");
    const publicPlaceIds = new Set(places.map((place) => place.id));
    const { data: aliasRows, error: aliasError } = await service
      .from("sns_place_mappings")
      .select("place_alias, confirmed_place_id, source_url_hash")
      .eq("moderation_status", "approved")
      .not("confirmed_place_id", "is", null)
      .neq("place_alias", "")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (aliasError) throw schemaError(aliasError);
    const approvedAliases = (aliasRows ?? []).flatMap((row): ApprovedSocialAlias[] => {
      const placeId = typeof row.confirmed_place_id === "string" ? row.confirmed_place_id : "";
      return placeId && publicPlaceIds.has(placeId) && typeof row.place_alias === "string"
        ? [{ alias: row.place_alias, placeId }]
        : [];
    });
    const exactHashAliases = (aliasRows ?? []).flatMap((row) => row.source_url_hash === sourceHash && typeof row.place_alias === "string" && row.place_alias.trim()
      ? [row.place_alias]
      : []);
    if (exactHashAliases.length) {
      clues = mergeSocialClues(clues, { ...emptySocialClues(), placeTerms: exactHashAliases });
    }
    const candidates = matchSocialPlaces(places, clues, localeValue as Locale, approvedAliases);
    const summary = socialClueSummary(clues);
    const processingStatus = candidates.length ? "completed" : "no_match";
    const { data: mapping, error: mappingError } = await service
      .from("sns_place_mappings")
      .insert({
        source_platform: platform,
        source_url_hash: sourceHash,
        input_kind: inputKind,
        extracted_place_terms: clues.placeTerms.slice(0, 24),
        extracted_region_terms: clues.regionTerms.slice(0, 24),
        extracted_station_terms: clues.stationTerms.slice(0, 24),
        extracted_menu_terms: clues.menuTerms.slice(0, 24),
        extracted_landmark_terms: clues.landmarkTerms.slice(0, 24),
        extracted_hashtags: clues.hashtags.slice(0, 24),
        place_alias: clues.placeTerms[0]?.slice(0, 300) ?? "",
        alias_locale: localeValue,
        match_confidence: candidates[0]?.confidence ?? null,
        moderation_status: "pending",
        processing_status: processingStatus,
        created_by: actor.userId,
        created_by_device_hash: actor.userId ? null : actor.deviceHash,
        match_notes: {
          clue_count: summary.length,
          candidate_count: candidates.length,
          ocr_status: ocrStatus,
          normalized_url_stored: false,
        },
      })
      .select("id")
      .single();
    if (mappingError || !mapping) throw schemaError(mappingError ?? new Error("Mapping insert failed."));

    if (candidates.length) {
      const candidateInsert = await service.from("sns_place_candidates").insert(candidates.map((candidate) => ({
        mapping_id: mapping.id,
        place_id: candidate.id,
        confidence: candidate.confidence,
        match_reasons: candidate.matchedClues,
        match_source: candidate.matchSource,
      })));
      if (candidateInsert.error) throw schemaError(candidateInsert.error);
    }
    await service.from("social_discovery_requests").update({
      result_status: candidates.length ? "matched" : "no_match",
      mapping_id: mapping.id,
      candidate_count: candidates.length,
    }).eq("id", requestId);

    const response = NextResponse.json({
      mappingId: mapping.id,
      confirmationToken: signSocialConfirmation(mapping.id, actor),
      candidates,
      clues: summary,
      platform,
      ocrStatus,
    }, { headers: noStoreHeaders });
    setSocialDeviceCookie(response, actor);
    return response;
  } catch (error) {
    if (service && requestId) await markRequest(service, requestId, "failed");
    if (error instanceof SocialDiscoveryInputError) return json({ message: error.message }, 400);
    if (error instanceof SocialActorError) return json({ message: error.message }, 401);
    if (error instanceof ServerConfigurationError) return json({ message: "social_discovery_not_configured" }, 503);
    if (error instanceof SyntaxError) return json({ message: "invalid_input" }, 400);
    return json({ message: isMissingSchema(error) ? "social_discovery_migration_required" : "search_failed" }, isMissingSchema(error) ? 503 : 500);
  }
}

async function markRequest(service: ReturnType<typeof createServerServiceClient>, requestId: string, resultStatus: string) {
  if (!requestId) return;
  await service.from("social_discovery_requests").update({ result_status: resultStatus }).eq("id", requestId);
}

function schemaError(error: unknown) {
  return error;
}

function isMissingSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(value.code ?? "")
    || value.message?.includes("register_social_discovery_request") === true;
}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}
