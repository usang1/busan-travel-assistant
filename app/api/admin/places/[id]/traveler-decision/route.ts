import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { createEmptyTravelerDecisionBundle, validateTravelerDecisionSection } from "@/lib/traveler-decision-validation";
import type { TravelerDecisionBundle, TravelerDecisionSection } from "@/types/traveler-decision";

type RouteContext = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function placeId(context: RouteContext) {
  const { id } = await context.params;
  if (!uuid.test(id)) throw publicError("장소 ID가 올바르지 않습니다.", 400);
  return id;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const id = await placeId(context);
    const [decision, practical, operating, menus, evidence, connections] = await Promise.all([
      client.from("place_decision_profiles").select("*").eq("place_id", id).maybeSingle(),
      client.from("place_china_info").select("*").eq("place_id", id).maybeSingle(),
      client.from("place_operating_profiles").select("*").eq("place_id", id).maybeSingle(),
      client.from("place_menu_items").select("*").eq("place_id", id).order("sort_order"),
      client.from("place_fact_evidence").select("*").eq("place_id", id).order("created_at"),
      client.from("place_connections").select("*").eq("from_place_id", id).order("priority", { ascending: false }),
    ]);
    const error = [decision, practical, operating, menus, evidence, connections].find((result) => result.error)?.error;
    if (error) throw migrationError(error);
    return NextResponse.json({ bundle: toBundle(decision.data, practical.data, operating.data, menus.data ?? [], evidence.data ?? [], connections.data ?? []) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { client } = await requireAdmin(request);
    const id = await placeId(context);
    const body = await request.json() as { section?: TravelerDecisionSection; value?: unknown };
    let input = body.value;
    if (body.section === "decision") {
      const { count, error } = await client.from("place_fact_evidence").select("id", { count: "exact", head: true }).eq("place_id", id).in("verification_status", ["verified", "partially_verified"]);
      if (error) throw migrationError(error);
      input = { ...(isRecord(input) ? input : {}), evidence_count: count ?? 0 };
    }
    const value = validateTravelerDecisionSection(body.section, input);
    await saveSection(client, id, body.section as TravelerDecisionSection, value);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>["client"];

async function saveSection(client: AdminClient, id: string, section: TravelerDecisionSection, value: unknown) {
  if (section === "decision") {
    const row = value as TravelerDecisionBundle["decision"];
    const { order_difficulty, ...profile } = row;
    const { error } = await client.from("place_decision_profiles").upsert({ ...profile, place_id: id }, { onConflict: "place_id" });
    if (error) throw migrationError(error);
    const { error: practicalError } = await client.from("place_china_info").upsert({ place_id: id, ordering_difficulty: order_difficulty }, { onConflict: "place_id" });
    if (practicalError) throw migrationError(practicalError);
    return;
  }
  if (section === "practical") {
    const row = value as TravelerDecisionBundle["practical"];
    const { data: existing, error: existingError } = await client.from("place_china_info").select("traveler_insights").eq("place_id", id).maybeSingle();
    if (existingError) throw migrationError(existingError);
    const travelerInsights = {
      ...(isRecord(existing?.traveler_insights) ? existing.traveler_insights : {}),
      english_menu: row.english_menu,
      luggage_storage: row.luggage_storage,
    };
    const { error } = await client.from("place_china_info").upsert({
      place_id: id, spicy_level: row.spicy_level, greasy_level: row.oily_level, smell_level: row.aroma_level,
      sweetness_level: row.sweetness_level, portion_level: row.portion_level,
      taste_notes_ko: row.taste_notes.ko, taste_notes_zh: row.taste_notes.zh, taste_notes_en: row.taste_notes.en, taste_notes_ja: row.taste_notes.ja,
      foreign_card: row.foreign_card, alipay: row.alipay, wechat_pay: row.wechat_pay, chinese_menu: row.chinese_menu,
      traveler_insights: travelerInsights, kiosk_language_support: row.kiosk_language_support, solo_friendly: row.solo_friendly,
      luggage_friendly: row.luggage_friendly, toilet_available: row.restroom,
      restroom_location_note: row.restroom_location_note || null, reservation_required: row.reservation_required,
      minimum_order_amount: row.minimum_order_amount, minimum_order_people: row.minimum_order_people,
      wheelchair_access: row.wheelchair_access, elevator: row.elevator, stroller_friendly: row.stroller_friendly,
      power_outlet: row.power_outlet, wifi: row.wifi, smoking_policy: row.smoking_policy,
      queue_available: row.queue_available, queue_method: row.queue_method || null,
    }, { onConflict: "place_id" });
    if (error) throw migrationError(error);
    return;
  }
  if (section === "operating") {
    const { error } = await client.from("place_operating_profiles").upsert({ ...(value as TravelerDecisionBundle["operating"]), place_id: id }, { onConflict: "place_id" });
    if (error) throw migrationError(error);
    return;
  }
  if (section === "menus") {
    const rows = (value as TravelerDecisionBundle["menus"]).map((item) => ({
      id: item.id ?? crypto.randomUUID(), place_id: id, name_ko: item.korean_original_name,
      name_zh: item.localized_name.zh, description_zh: item.ordering_note.zh, price: item.price,
      is_recommended: item.recommendation_status === "yes", localized_name: item.localized_name,
      korean_original_name: item.korean_original_name, recommendation_status: item.recommendation_status,
      recommendation_basis: item.recommendation_basis || null, spicy_level: item.spicy_level, oily_level: item.oily_level,
      aroma_level: item.aroma_level, portion_size: item.portion_size, recommended_party_size: item.recommended_party_size,
      ordering_note: item.ordering_note, menu_warning: item.menu_warning, availability_time: item.availability_time,
      sold_out_risk: item.sold_out_risk, sort_order: item.sort_order,
    }));
    await replaceRows(client, "place_menu_items", "place_id", id, rows);
    return;
  }
  if (section === "evidence") {
    const rows = (value as TravelerDecisionBundle["evidence"]).map((item) => ({ ...item, id: item.id ?? crypto.randomUUID(), place_id: id, source_url: item.source_url || null }));
    await replaceRows(client, "place_fact_evidence", "place_id", id, rows);
    return;
  }
  const rows = (value as TravelerDecisionBundle["connections"]).map((item) => ({ ...item, id: item.id ?? crypto.randomUUID(), from_place_id: id }));
  if (rows.some((row) => row.to_place_id === id)) throw publicError("같은 장소끼리는 연결할 수 없습니다.", 400);
  await replaceRows(client, "place_connections", "from_place_id", id, rows);
}

async function replaceRows(client: AdminClient, table: string, ownerColumn: string, ownerId: string, rows: Array<Record<string, unknown>>) {
  const ids = rows.map((row) => String(row.id));
  if (rows.length) {
    const { error } = await client.from(table).upsert(rows);
    if (error) throw migrationError(error);
  }
  let remove = client.from(table).delete().eq(ownerColumn, ownerId);
  if (ids.length) remove = remove.not("id", "in", `(${ids.join(",")})`);
  const { error } = await remove;
  if (error) throw migrationError(error);
}

function toBundle(decisionRow: Record<string, unknown> | null, practicalRow: Record<string, unknown> | null, operatingRow: Record<string, unknown> | null, menuRows: Record<string, unknown>[], evidenceRows: Record<string, unknown>[], connectionRows: Record<string, unknown>[]): TravelerDecisionBundle {
  const empty = createEmptyTravelerDecisionBundle();
  const practical = practicalRow ?? {};
  const travelerInsights = isRecord(practical.traveler_insights) ? practical.traveler_insights : {};
  return {
    decision: { ...empty.decision, ...decisionRow, order_difficulty: numberOrNull(practical.ordering_difficulty), primary_warning: localeValue(decisionRow?.primary_warning), visit_summary: localeValue(decisionRow?.visit_summary) },
    practical: {
      ...empty.practical, spicy_level: numberOrNull(practical.spicy_level), oily_level: numberOrNull(practical.greasy_level),
      aroma_level: numberOrNull(practical.smell_level), sweetness_level: numberOrNull(practical.sweetness_level), portion_level: numberOrNull(practical.portion_level),
      taste_notes: { ko: stringValue(practical.taste_notes_ko), zh: stringValue(practical.taste_notes_zh), en: stringValue(practical.taste_notes_en), ja: stringValue(practical.taste_notes_ja) },
      foreign_card: tristate(practical.foreign_card), alipay: tristate(practical.alipay), wechat_pay: tristate(practical.wechat_pay),
      chinese_menu: tristate(practical.chinese_menu), english_menu: tristate(travelerInsights.english_menu),
      kiosk_language_support: isRecord(practical.kiosk_language_support) ? practical.kiosk_language_support as TravelerDecisionBundle["practical"]["kiosk_language_support"] : empty.practical.kiosk_language_support,
      solo_friendly: tristate(practical.solo_friendly), luggage_friendly: tristate(practical.luggage_friendly), luggage_storage: tristate(travelerInsights.luggage_storage),
      restroom: tristate(practical.toilet_available), restroom_location_note: stringValue(practical.restroom_location_note), reservation_required: tristate(practical.reservation_required),
      minimum_order_amount: numberOrNull(practical.minimum_order_amount), minimum_order_people: numberOrNull(practical.minimum_order_people),
      wheelchair_access: tristate(practical.wheelchair_access), elevator: tristate(practical.elevator), stroller_friendly: tristate(practical.stroller_friendly),
      power_outlet: tristate(practical.power_outlet), wifi: tristate(practical.wifi),
      smoking_policy: ["non_smoking", "smoking_area", "smoking_allowed"].includes(String(practical.smoking_policy)) ? practical.smoking_policy as TravelerDecisionBundle["practical"]["smoking_policy"] : null,
      queue_available: tristate(practical.queue_available), queue_method: stringValue(practical.queue_method),
    },
    operating: { ...empty.operating, ...operatingRow, last_order_time: operatingRow?.last_order_time ? stringValue(operatingRow.last_order_time).slice(0, 5) : null, holiday_notes: localeValue(operatingRow?.holiday_notes) },
    menus: menuRows.map((row, index) => ({
      id: String(row.id), localized_name: localeValue(row.localized_name, { ko: stringValue(row.name_ko), zh: stringValue(row.name_zh), en: "", ja: "" }),
      korean_original_name: stringValue(row.korean_original_name) || stringValue(row.name_ko), price: numberOrNull(row.price),
      recommendation_status: tristate(row.recommendation_status, row.is_recommended === true ? "yes" : "unknown"), recommendation_basis: stringValue(row.recommendation_basis),
      spicy_level: numberOrNull(row.spicy_level), oily_level: numberOrNull(row.oily_level), aroma_level: numberOrNull(row.aroma_level),
      portion_size: numberOrNull(row.portion_size), recommended_party_size: numberOrNull(row.recommended_party_size), ordering_note: localeValue(row.ordering_note),
      menu_warning: localeValue(row.menu_warning), availability_time: Array.isArray(row.availability_time) ? row.availability_time as TravelerDecisionBundle["menus"][number]["availability_time"] : [],
      sold_out_risk: numberOrNull(row.sold_out_risk), sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
    })),
    evidence: evidenceRows.map((row) => ({ id: String(row.id), field_key: stringValue(row.field_key), fact_value: row.fact_value,
      source_type: row.source_type as TravelerDecisionBundle["evidence"][number]["source_type"], source_label: stringValue(row.source_label), source_url: stringValue(row.source_url),
      observed_at: nullableString(row.observed_at), verified_at: nullableString(row.verified_at), verification_status: row.verification_status as TravelerDecisionBundle["evidence"][number]["verification_status"], notes: stringValue(row.notes) })),
    connections: connectionRows.map((row) => ({ id: String(row.id), to_place_id: stringValue(row.to_place_id), travel_minutes: numberOrNull(row.travel_minutes),
      travel_distance: numberOrNull(row.travel_distance), travel_mode: (row.travel_mode ?? null) as TravelerDecisionBundle["connections"][number]["travel_mode"],
      sequence_reason: localeValue(row.sequence_reason), valid_time_ranges: Array.isArray(row.valid_time_ranges) ? row.valid_time_ranges as TravelerDecisionBundle["connections"][number]["valid_time_ranges"] : [],
      weather_conditions: stringArray(row.weather_conditions), trip_theme: stringArray(row.trip_theme) as TravelerDecisionBundle["connections"][number]["trip_theme"], active: row.active !== false,
      priority: typeof row.priority === "number" ? row.priority : 0 })),
  };
}

function migrationError(error: { code?: string; message?: string }) {
  if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "")) return publicError("여행자 의사결정 DB migration(030)을 먼저 적용해주세요.", 503);
  return error;
}
function publicError(message: string, status: number) { return Object.assign(new Error(message), { status, expose: true }); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function localeValue(value: unknown, fallback = { ko: "", zh: "", en: "", ja: "" }) { return isRecord(value) ? { ko: stringValue(value.ko), zh: stringValue(value.zh), en: stringValue(value.en), ja: stringValue(value.ja) } : fallback; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function nullableString(value: unknown) { return typeof value === "string" && value ? value : null; }
function numberOrNull(value: unknown) { const number = typeof value === "number" ? value : Number(value); return value !== null && value !== "" && Number.isFinite(number) ? number : null; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function tristate(value: unknown, fallback: "yes" | "no" | "unknown" = "unknown") { return value === "yes" || value === "no" || value === "unknown" ? value : fallback; }
