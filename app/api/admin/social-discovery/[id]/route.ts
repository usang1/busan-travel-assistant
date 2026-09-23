import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = ["approve", "reject", "needs_review", "unmap", "alias"] as const;
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await request.json() as { action?: (typeof actions)[number]; placeId?: string; alias?: string };
    if (!uuidPattern.test(id)) return NextResponse.json({ message: "매핑 ID가 올바르지 않습니다." }, { status: 400 });
    if (!body.action || !actions.includes(body.action)) return NextResponse.json({ message: "지원하지 않는 작업입니다." }, { status: 400 });
    if (typeof body.alias === "string" && body.alias.length > 300) return NextResponse.json({ message: "별칭은 300자 이하여야 합니다." }, { status: 400 });

    if (body.action === "approve") {
      if (!body.placeId || !uuidPattern.test(body.placeId)) return NextResponse.json({ message: "승인할 장소를 선택해주세요." }, { status: 400 });
      const { data: place, error: placeError } = await client.from("places").select("id").eq("id", body.placeId).eq("city_code", "busan").eq("is_active", true).in("status", ["PUBLISHED", "ACTIVE"]).maybeSingle();
      if (placeError || !place) return NextResponse.json({ message: "공개·검수된 부산 장소만 매핑할 수 있습니다." }, { status: 409 });
      const candidate = await client.from("sns_place_candidates").select("place_id").eq("mapping_id", id).eq("place_id", body.placeId).maybeSingle();
      if (candidate.error || !candidate.data) return NextResponse.json({ message: "검색 후보에 포함된 장소만 승인할 수 있습니다." }, { status: 409 });
      await client.from("sns_place_candidates").update({ confirmed_by_user: false }).eq("mapping_id", id);
      const selected = await client.from("sns_place_candidates").update({ confirmed_by_user: true }).eq("mapping_id", id).eq("place_id", body.placeId);
      if (selected.error) throw migrationError(selected.error);
      const update = await client.from("sns_place_mappings").update({ confirmed_place_id: body.placeId, moderation_status: "approved", place_alias: body.alias?.trim() ?? undefined }).eq("id", id);
      if (update.error) throw migrationError(update.error);
    } else if (body.action === "unmap") {
      const candidates = await client.from("sns_place_candidates").update({ confirmed_by_user: false }).eq("mapping_id", id);
      if (candidates.error) throw migrationError(candidates.error);
      const update = await client.from("sns_place_mappings").update({ confirmed_place_id: null, confirmed_by_user_at: null, moderation_status: "needs_review" }).eq("id", id);
      if (update.error) throw migrationError(update.error);
    } else if (body.action === "alias") {
      const alias = body.alias?.normalize("NFKC").trim() ?? "";
      const update = await client.from("sns_place_mappings").update({ place_alias: alias }).eq("id", id);
      if (update.error) throw migrationError(update.error);
    } else {
      const update = await client.from("sns_place_mappings").update({ moderation_status: body.action }).eq("id", id);
      if (update.error) throw migrationError(update.error);
    }
    return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function migrationError(error: { code?: string }) {
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return Object.assign(new Error("SNS 장소 매칭 DB migration 034를 먼저 적용해주세요."), { status: 503, expose: true });
  }
  return error;
}
