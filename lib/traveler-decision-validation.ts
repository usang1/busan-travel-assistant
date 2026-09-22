import { travelerThemes, type LocaleText, type TravelerDecisionBundle, type TravelerDecisionSection } from "@/types/traveler-decision";

const verificationStatuses = ["verified", "partially_verified", "unverified", "stale", "conflicting", "rejected"] as const;
const sourceTypes = ["official_source", "owner_merchant", "administrator", "traveler_report", "inferred", "unverified"] as const;
const tristates = ["yes", "no", "unknown"] as const;
const travelModes = ["walk", "transit", "taxi", "car", "mixed"] as const;
const detourLevels = ["nearby_only", "worth_short_detour", "worth_long_detour", "destination"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fieldKey = /^[a-z][a-z0-9_.]{1,99}$/;
const locales = ["ko", "zh", "en", "ja"] as const;

export function emptyLocaleText(): LocaleText {
  return { ko: "", zh: "", en: "", ja: "" };
}

export function createEmptyTravelerDecisionBundle(): TravelerDecisionBundle {
  const unknown = "unknown" as const;
  return {
    decision: {
      tourist_fit_score: null, recommended_for: [], not_recommended_for: [], primary_warning: emptyLocaleText(),
      visit_summary: emptyLocaleText(), worth_detour_level: null, order_difficulty: null, solo_difficulty: null,
      foreigner_difficulty: null, confidence_score: null, evidence_count: 0, last_verified_at: null,
      verification_status: "unverified",
    },
    practical: {
      spicy_level: null, oily_level: null, aroma_level: null, sweetness_level: null, portion_level: null,
      taste_notes: emptyLocaleText(), foreign_card: unknown, alipay: unknown, wechat_pay: unknown,
      chinese_menu: unknown, english_menu: unknown, kiosk_language_support: { status: unknown, languages: [] },
      solo_friendly: unknown, luggage_friendly: unknown, luggage_storage: unknown, restroom: unknown,
      restroom_location_note: "", reservation_required: unknown, minimum_order_amount: null,
      minimum_order_people: null, wheelchair_access: unknown, elevator: unknown, stroller_friendly: unknown,
      power_outlet: unknown, wifi: unknown, smoking_policy: null, queue_available: unknown, queue_method: "",
    },
    operating: {
      timezone: "Asia/Seoul", structured_operating_hours: [], last_order_time: null, temporary_closures: [],
      recommended_time_ranges: [], avoid_time_ranges: [], wait_time_by_weekday_hour: {}, sellout_risk_by_hour: {},
      photo_time_ranges: [], seasonal_availability: [], holiday_notes: emptyLocaleText(), verification_status: "unverified", last_verified_at: null,
    },
    menus: [], evidence: [], connections: [],
  };
}

export function validateTravelerDecisionSection(section: unknown, value: unknown) {
  if (!["decision", "practical", "operating", "menus", "evidence", "connections"].includes(String(section))) {
    throw inputError("저장할 편집 영역이 올바르지 않습니다.");
  }
  const name = section as TravelerDecisionSection;
  if (name === "decision") return validateDecision(value);
  if (name === "practical") return validatePractical(value);
  if (name === "operating") return validateOperating(value);
  if (name === "menus") return validateMenus(value);
  if (name === "evidence") return validateEvidence(value);
  return validateConnections(value);
}

function validateDecision(value: unknown): TravelerDecisionBundle["decision"] {
  const input = object(value);
  const result: TravelerDecisionBundle["decision"] = {
    tourist_fit_score: nullableNumber(input.tourist_fit_score, 0, 100),
    recommended_for: themes(input.recommended_for), not_recommended_for: themes(input.not_recommended_for),
    primary_warning: localeText(input.primary_warning), visit_summary: localeText(input.visit_summary),
    worth_detour_level: nullableOneOf(input.worth_detour_level, detourLevels),
    order_difficulty: nullableInteger(input.order_difficulty, 1, 5),
    solo_difficulty: nullableInteger(input.solo_difficulty, 1, 5),
    foreigner_difficulty: nullableInteger(input.foreigner_difficulty, 1, 5),
    confidence_score: nullableNumber(input.confidence_score, 0, 100),
    evidence_count: integer(input.evidence_count ?? 0, 0, 100000),
    last_verified_at: nullableDateTime(input.last_verified_at),
    verification_status: oneOf(input.verification_status, verificationStatuses, "확인 상태"),
  };
  const recommends = result.tourist_fit_score !== null || result.recommended_for.length > 0 || result.worth_detour_level !== null;
  if (recommends && result.evidence_count === 0) throw inputError("추천도·추천 대상·우회 방문 가치는 확인된 근거를 먼저 저장해야 합니다.");
  if (result.tourist_fit_score !== null && result.confidence_score === null) throw inputError("방문 적합도 점수에는 신뢰도 점수가 필요합니다.");
  if (["verified", "partially_verified"].includes(result.verification_status) && !result.last_verified_at) throw inputError("확인 완료 상태에는 마지막 확인일이 필요합니다.");
  return result;
}

function validatePractical(value: unknown): TravelerDecisionBundle["practical"] {
  const input = object(value);
  const kiosk = object(input.kiosk_language_support);
  const result = createEmptyTravelerDecisionBundle().practical;
  for (const key of ["spicy_level", "oily_level", "aroma_level", "sweetness_level", "portion_level"] as const) result[key] = nullableInteger(input[key], 1, 5);
  result.taste_notes = localeText(input.taste_notes);
  for (const key of ["foreign_card", "alipay", "wechat_pay", "chinese_menu", "english_menu", "solo_friendly", "luggage_friendly", "luggage_storage", "restroom", "reservation_required", "wheelchair_access", "elevator", "stroller_friendly", "power_outlet", "wifi", "queue_available"] as const) result[key] = oneOf(input[key], tristates, key);
  result.kiosk_language_support = { status: oneOf(kiosk.status, tristates, "키오스크 지원 상태"), languages: shortTextArray(kiosk.languages, 20) };
  if (result.kiosk_language_support.status !== "yes" && result.kiosk_language_support.languages.length) throw inputError("키오스크 언어 목록은 지원 상태가 '예'일 때만 입력합니다.");
  result.restroom_location_note = text(input.restroom_location_note, 1000);
  result.minimum_order_amount = nullableInteger(input.minimum_order_amount, 0, 100000000);
  result.minimum_order_people = nullableInteger(input.minimum_order_people, 1, 20);
  result.smoking_policy = nullableOneOf(input.smoking_policy, ["non_smoking", "smoking_area", "smoking_allowed"] as const);
  result.queue_method = text(input.queue_method, 1000);
  return result;
}

function validateOperating(value: unknown): TravelerDecisionBundle["operating"] {
  const input = object(value);
  if (input.timezone !== "Asia/Seoul") throw inputError("운영시간 기준은 Asia/Seoul이어야 합니다.");
  const structured = array(input.structured_operating_hours, 7).map((entry) => {
    const row = object(entry); const closed = boolean(row.closed); const overnight = row.overnight === true; const open = time(row.open, closed); const close = time(row.close, closed);
    if (!closed && !overnight && open >= close) throw inputError("운영 종료시간은 시작시간보다 늦어야 합니다.");
    if (!closed && overnight && open < close) throw inputError("자정 이후 종료는 종료시간이 시작시간보다 이른 경우에만 선택합니다.");
    return { weekday: integer(row.weekday, 0, 6), open, close, closed, overnight };
  });
  if (new Set(structured.map((day) => day.weekday)).size !== structured.length) throw inputError("요일별 영업시간은 한 번씩만 입력해주세요.");
  const lastOrder = nullableTime(input.last_order_time);
  if (lastOrder && structured.some((day) => !day.closed && !timeFallsInside(lastOrder, day))) throw inputError("라스트오더는 운영시간 안이고 종료시간보다 늦지 않아야 합니다.");
  const recommended = ranges(input.recommended_time_ranges);
  const avoid = ranges(input.avoid_time_ranges);
  assertNoRangeConflicts(recommended, "추천 시간대");
  assertNoRangeConflicts(avoid, "피해야 할 시간대");
  assertNoCrossRangeConflicts(recommended, avoid);
  const verificationStatus = oneOf(input.verification_status, verificationStatuses, "시간 정보 확인 상태");
  const lastVerifiedAt = nullableDateTime(input.last_verified_at);
  if (["verified", "partially_verified"].includes(verificationStatus) && !lastVerifiedAt) throw inputError("확인된 시간 정보에는 마지막 확인일이 필요합니다.");
  return {
    timezone: "Asia/Seoul", structured_operating_hours: structured, last_order_time: lastOrder,
    temporary_closures: array(input.temporary_closures, 100).map((entry) => { const row = object(entry); const start = date(row.start_date); const end = date(row.end_date); if (start > end) throw inputError("임시 휴무 종료일을 확인해주세요."); return { start_date: start, end_date: end, reason: text(row.reason, 500) }; }),
    recommended_time_ranges: recommended, avoid_time_ranges: avoid,
    wait_time_by_weekday_hour: numericRecord(input.wait_time_by_weekday_hour, 0, 1440),
    sellout_risk_by_hour: numericRecord(input.sellout_risk_by_hour, 1, 5), photo_time_ranges: ranges(input.photo_time_ranges),
    seasonal_availability: array(input.seasonal_availability, 24).map((entry) => { const row = object(entry); return { start_month: integer(row.start_month, 1, 12), end_month: integer(row.end_month, 1, 12), note: text(row.note, 500) }; }),
    holiday_notes: localeText(input.holiday_notes), verification_status: verificationStatus, last_verified_at: lastVerifiedAt,
  };
}

function validateMenus(value: unknown): TravelerDecisionBundle["menus"] {
  return array(value, 100).map((entry, index) => {
    const row = object(entry); const names = localeText(row.localized_name); const recommendation = oneOf(row.recommendation_status, tristates, "메뉴 추천 상태"); const basis = text(row.recommendation_basis, 1000);
    if (!names.ko.trim()) throw inputError("메뉴의 한국어 원문 이름은 필수입니다.");
    if (recommendation === "yes" && !basis) throw inputError("추천 메뉴에는 추천 근거가 필요합니다.");
    return {
      ...(typeof row.id === "string" && uuid.test(row.id) ? { id: row.id } : {}), localized_name: names,
      korean_original_name: text(row.korean_original_name, 300) || names.ko, price: nullableInteger(row.price, 0, 100000000),
      recommendation_status: recommendation, recommendation_basis: basis,
      spicy_level: nullableInteger(row.spicy_level, 1, 5), oily_level: nullableInteger(row.oily_level, 1, 5),
      aroma_level: nullableInteger(row.aroma_level, 1, 5), portion_size: nullableInteger(row.portion_size, 1, 5),
      recommended_party_size: nullableInteger(row.recommended_party_size, 1, 20), ordering_note: localeText(row.ordering_note),
      menu_warning: localeText(row.menu_warning), availability_time: ranges(row.availability_time),
      sold_out_risk: nullableInteger(row.sold_out_risk, 1, 5), sort_order: integer(row.sort_order ?? index, 0, 10000),
    };
  });
}

function validateEvidence(value: unknown): TravelerDecisionBundle["evidence"] {
  return array(value, 200).map((entry) => {
    const row = object(entry); const status = oneOf(row.verification_status, verificationStatuses, "근거 확인 상태");
    const source = oneOf(row.source_type, sourceTypes, "근거 출처"); const observed = nullableDateTime(row.observed_at);
    if (!fieldKey.test(String(row.field_key ?? ""))) throw inputError("근거 필드 키 형식을 확인해주세요.");
    if (["verified", "partially_verified"].includes(status) && (source === "unverified" || !observed)) throw inputError("확인된 근거에는 출처 종류와 관찰일이 필요합니다.");
    return {
      ...(typeof row.id === "string" && uuid.test(row.id) ? { id: row.id } : {}), field_key: String(row.field_key), fact_value: row.fact_value ?? null,
      source_type: source, source_label: text(row.source_label, 200), source_url: httpUrl(row.source_url), observed_at: observed,
      verified_at: nullableDateTime(row.verified_at), verification_status: status, notes: text(row.notes, 4000),
    };
  });
}

function validateConnections(value: unknown): TravelerDecisionBundle["connections"] {
  const seen = new Set<string>();
  return array(value, 100).map((entry) => {
    const row = object(entry); const target = String(row.to_place_id ?? "").toLowerCase();
    if (!uuid.test(target) || seen.has(target)) throw inputError("연결 장소가 올바르지 않거나 중복되었습니다."); seen.add(target);
    return {
      ...(typeof row.id === "string" && uuid.test(row.id) ? { id: row.id } : {}), to_place_id: target,
      travel_minutes: nullableInteger(row.travel_minutes, 0, 1440), travel_distance: nullableInteger(row.travel_distance, 0, 10000000),
      travel_mode: nullableOneOf(row.travel_mode, travelModes), sequence_reason: localeText(row.sequence_reason),
      valid_time_ranges: ranges(row.valid_time_ranges), weather_conditions: shortTextArray(row.weather_conditions, 20),
      trip_theme: themes(row.trip_theme), active: boolean(row.active), priority: integer(row.priority, 0, 100),
    };
  });
}

function ranges(value: unknown) {
  return array(value, 100).map((entry) => { const row = object(entry); const start = time(row.start); const end = time(row.end); if (start >= end) throw inputError("시간 범위의 종료시간은 시작시간보다 늦어야 합니다."); return { weekdays: array(row.weekdays, 7).map((day) => integer(day, 0, 6)), start, end, note: text(row.note, 500) }; });
}
function assertNoRangeConflicts(value: ReturnType<typeof ranges>, label: string) {
  for (let left = 0; left < value.length; left += 1) for (let right = left + 1; right < value.length; right += 1) {
    if (rangesOverlap(value[left], value[right])) throw inputError(`${label}에 서로 겹치는 시간이 있습니다.`);
  }
}
function assertNoCrossRangeConflicts(recommended: ReturnType<typeof ranges>, avoid: ReturnType<typeof ranges>) {
  if (recommended.some((left) => avoid.some((right) => rangesOverlap(left, right)))) throw inputError("추천 시간대와 피해야 할 시간대가 서로 겹칩니다.");
}
function rangesOverlap(left: ReturnType<typeof ranges>[number], right: ReturnType<typeof ranges>[number]) { return left.weekdays.some((day) => right.weekdays.includes(day)) && left.start < right.end && right.start < left.end; }
function timeFallsInside(value: string, day: { open: string; close: string; overnight: boolean }) {
  const current = minutes(value); const open = minutes(day.open); const close = minutes(day.close) + (day.overnight ? 1440 : 0); const adjusted = day.overnight && current < open ? current + 1440 : current;
  return adjusted >= open && adjusted <= close;
}
function minutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function localeText(value: unknown): LocaleText { const input = object(value); return Object.fromEntries(locales.map((locale) => [locale, text(input[locale], 4000)])) as LocaleText; }
function themes(value: unknown) { const values = shortTextArray(value, travelerThemes.length); if (values.some((item) => !travelerThemes.includes(item as (typeof travelerThemes)[number]))) throw inputError("여행 유형 값을 확인해주세요."); return values as TravelerDecisionBundle["decision"]["recommended_for"]; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw inputError("입력 형식을 확인해주세요."); return value as Record<string, unknown>; }
function array(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) throw inputError(`목록은 ${max}개 이내로 입력해주세요.`); return value; }
function text(value: unknown, max: number) { if (value === undefined || value === null) return ""; if (typeof value !== "string" || value.length > max) throw inputError(`문자열은 ${max}자 이내로 입력해주세요.`); return value.trim(); }
function integer(value: unknown, min: number, max: number) { if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw inputError(`${min}~${max} 범위의 정수를 입력해주세요.`); return value; }
function nullableInteger(value: unknown, min: number, max: number) { return value === null || value === undefined || value === "" ? null : integer(value, min, max); }
function nullableNumber(value: unknown, min: number, max: number) { if (value === null || value === undefined || value === "") return null; if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw inputError(`${min}~${max} 범위의 숫자를 입력해주세요.`); return value; }
function boolean(value: unknown) { if (typeof value !== "boolean") throw inputError("예/아니오 값을 확인해주세요."); return value; }
function oneOf<const Value extends string>(value: unknown, values: readonly Value[], label: string): Value { if (typeof value !== "string" || !values.includes(value as Value)) throw inputError(`${label} 값을 확인해주세요.`); return value as Value; }
function nullableOneOf<const Value extends string>(value: unknown, values: readonly Value[]): Value | null { return value === null || value === undefined || value === "" ? null : oneOf(value, values, "선택"); }
function shortTextArray(value: unknown, max: number) { return array(value, max).map((item) => text(item, 100)).filter(Boolean); }
function time(value: unknown, allowEmpty = false) { const result = text(value, 5); if (allowEmpty && !result) return ""; if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result)) throw inputError("시간은 HH:MM 형식으로 입력해주세요."); return result; }
function nullableTime(value: unknown) { return value === null || value === undefined || value === "" ? null : time(value); }
function date(value: unknown) { const result = text(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) throw inputError("날짜 형식을 확인해주세요."); return result; }
function nullableDateTime(value: unknown) { if (value === null || value === undefined || value === "") return null; const result = text(value, 40); if (!Number.isFinite(Date.parse(result))) throw inputError("확인일 형식을 확인해주세요."); return new Date(result).toISOString(); }
function numericRecord(value: unknown, min: number, max: number) { const input = object(value); const output: Record<string, number | null> = {}; for (const [key, item] of Object.entries(input)) { if (!/^[0-6]-(?:[01]\d|2[0-3])$/.test(key)) throw inputError("요일-시간 키 형식을 확인해주세요."); output[key] = nullableNumber(item, min, max); } return output; }
function httpUrl(value: unknown) { const result = text(value, 2048); if (!result) return ""; try { if (!["http:", "https:"].includes(new URL(result).protocol)) throw new Error(); } catch { throw inputError("출처 URL을 확인해주세요."); } return result; }
function inputError(message: string) { return Object.assign(new Error(message), { status: 400, expose: true }); }
