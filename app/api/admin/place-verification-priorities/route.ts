import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [places, events, recommendations, fields, rules] = await Promise.all([
      client.from("places").select("id,name_ko,address_ko,latitude,longitude,opening_hours,phone,thumbnail_url,last_verified_at,status,is_active").neq("status", "ARCHIVED").limit(5000),
      client.from("place_action_events").select("place_id,event_type").in("event_type", ["place_view", "directions_click"]).gte("created_at", since).not("place_id", "is", null).limit(20000),
      client.from("stay_recommendations").select("place_id").eq("is_active", true).limit(5000),
      client.from("place_field_verifications").select("place_id,field_name,verification_status,verified_at,updated_at,has_conflict").limit(20000),
      client.from("place_verification_field_rules").select("field_name,stale_after_days,enabled"),
    ]);
    const failure = [places, events, recommendations, fields, rules].find((result) => result.error)?.error;
    if (failure) throw migrationError(failure);
    const metrics = new Map<string, { views: number; directions: number }>();
    for (const event of events.data ?? []) { const key = String(event.place_id); const value = metrics.get(key) ?? { views: 0, directions: 0 }; if (event.event_type === "place_view") value.views += 1; else value.directions += 1; metrics.set(key, value); }
    const qrPlaces = new Set((recommendations.data ?? []).map((row) => String(row.place_id)));
    const fieldRows = new Map<string, typeof fields.data>();
    for (const field of fields.data ?? []) fieldRows.set(String(field.place_id), [...(fieldRows.get(String(field.place_id)) ?? []), field]);
    const ruleMap = new Map((rules.data ?? []).filter((rule) => rule.enabled).map((rule) => [rule.field_name, Number(rule.stale_after_days)]));
    const queue = (places.data ?? []).map((place) => {
      const event = metrics.get(place.id) ?? { views: 0, directions: 0 };
      const missing = [["주소", place.address_ko], ["좌표", place.latitude !== null && place.longitude !== null], ["영업시간", place.opening_hours], ["전화번호", place.phone], ["대표 사진", place.thumbnail_url]].filter((entry) => !entry[1]).map((entry) => String(entry[0]));
      const relatedFields = fieldRows.get(place.id) ?? [];
      const conflicts = relatedFields.filter((field) => field.has_conflict).length;
      const stale = relatedFields.filter((field) => { const days = ruleMap.get(field.field_name); if (!days) return false; const reference = new Date(field.verified_at ?? field.updated_at).getTime(); return Number.isFinite(reference) && Date.now() - reference > days * 86_400_000; }).length;
      const reasons: string[] = [];
      if (qrPlaces.has(place.id)) reasons.push("숙소 QR 추천");
      if (event.directions) reasons.push(`길찾기 ${event.directions}`);
      if (event.views) reasons.push(`조회 ${event.views}`);
      if (missing.length) reasons.push(`누락 ${missing.join("·")}`);
      if (stale) reasons.push(`재확인 ${stale}개`);
      if (conflicts) reasons.push(`충돌 ${conflicts}개`);
      const score = (qrPlaces.has(place.id) ? 50 : 0) + Math.min(event.directions * 3, 30) + Math.min(event.views, 20) + missing.length * 8 + stale * 8 + conflicts * 25;
      return { placeId: place.id, name: place.name_ko, score, reasons, views: event.views, directions: event.directions, missing, stale, conflicts, stayRecommended: qrPlaces.has(place.id) };
    }).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "ko"));
    return NextResponse.json({ queue }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

function migrationError(error: { code?: string; message?: string }) { return ["42P01", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "") ? Object.assign(new Error("검증 우선순위에는 DB 마이그레이션(050, 053)이 필요합니다."), { status: 503, expose: true }) : error; }
