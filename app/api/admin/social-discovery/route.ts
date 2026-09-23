import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

const statuses = ["pending", "approved", "rejected", "needs_review", "all"] as const;

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const status = new URL(request.url).searchParams.get("status") ?? "pending";
    if (!statuses.includes(status as (typeof statuses)[number])) return NextResponse.json({ message: "지원하지 않는 상태입니다." }, { status: 400 });

    let mappingQuery = client
      .from("sns_place_mappings")
      .select("id, source_platform, input_kind, extracted_place_terms, extracted_region_terms, extracted_station_terms, extracted_menu_terms, extracted_landmark_terms, extracted_hashtags, place_alias, alias_locale, match_confidence, confirmed_place_id, confirmed_by_user_at, moderation_status, processing_status, match_notes, created_at, updated_at, sns_place_candidates(place_id, confidence, match_reasons, match_source, confirmed_by_user, places(id, slug, name_ko, name_zh, address_ko, city_code, district_code, status, is_active))")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") mappingQuery = mappingQuery.eq("moderation_status", status);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: mappings, error: mappingError }, { data: requests, error: requestError }] = await Promise.all([
      mappingQuery,
      client.from("social_discovery_requests").select("source_platform, result_status, input_kind, used_ocr, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
    ]);
    if (mappingError) throw migrationError(mappingError);
    if (requestError) throw migrationError(requestError);
    return NextResponse.json({ mappings: mappings ?? [], requests: requests ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function migrationError(error: { code?: string }) {
  if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return Object.assign(new Error("SNS 장소 매칭 DB migration 034를 먼저 적용해주세요."), { status: 503, expose: true });
  }
  return error;
}
