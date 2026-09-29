import { getPlaceContent, type Locale } from "@/lib/i18n";
import { cityRegions, parsePlaceCity, placeCityLabels, type PlaceCity } from "@/lib/city-regions";
import { calculateDistanceMeters, estimateWalkingMinutes, hasCoordinates } from "@/lib/location";
import { recommendMenuCombination } from "@/lib/menu-guidance";
import { isVerifiedPlace } from "@/lib/place-publication-quality";
import { isPublicPlace } from "@/lib/place-publishing";
import { isCityScopedPlace } from "@/lib/place-scope";
import { formatTimeAwarePrimary, getTimeAwareNotices, getTimeAwarePlaceState } from "@/lib/time-aware-place";
import type { PlaceWithRelations } from "@/types/database";
import type {
  ExistingItineraryStop,
  GroundedPlanPlace,
  GroundedTripConditions,
  GroundedTripPlan,
  GroundedTripRequest,
  GroundedTravelType,
  GroundedWalkingPreference,
  GroundedWeather,
} from "@/types/grounded-trip";

const blockedTimeCodes = new Set(["closes_before_arrival", "after_last_order", "closed_today", "temporary_closed"]);
const stayByCategory = { restaurant: 55, cafe: 40, bar: 60, attraction: 45, shopping: 40, photo_spot: 30, luggage: 15 } as const;
const maxInputTextLength = 800;

type RankedCandidate = { place: PlaceWithRelations; score: number; matched: string[]; unresolved: string[] };
type AiSelection = { ordered_place_ids: string[]; alternative_place_ids?: string[] };

export class GroundedTripInputError extends Error {}

export function normalizeGroundedTripRequest(value: unknown, now = new Date()): GroundedTripRequest {
  const root = record(value);
  const source = record(root.conditions);
  const requestText = cleanText(root.request_text, maxInputTextLength);
  const parsed = parseNaturalTripRequest(requestText);
  const language = locale(source.language);
  const availableMinutes = integer(parsed.available_minutes ?? source.available_minutes, 60, 720, 180);
  const start = validDate(source.start_time) ?? now;
  const explicitEnd = validDate(source.end_time);
  const end = explicitEnd && explicitEnd > start ? explicitEnd : new Date(start.getTime() + availableMinutes * 60_000);
  const currentLocation = normalizeLocation(source.current_location, parsed.district_code, parsed.city_code);
  const saved = uuidArray(source.saved_places, 100);
  const mustVisit = uuidArray(source.must_visit_places, 12).filter((id) => !saved.includes(id) || id.length > 0);
  const existing = Array.isArray(root.existing_itinerary)
    ? root.existing_itinerary.slice(0, 30).flatMap(normalizeExistingStop)
    : [];

  return {
    mode: root.mode === "recover" ? "recover" : "plan",
    request_text: requestText,
    conditions: {
      current_location: currentLocation,
      available_minutes: Math.min(720, Math.max(60, Math.round((end.getTime() - start.getTime()) / 60_000))),
      party_size: integer(parsed.party_size ?? source.party_size, 1, 12, 1),
      travel_type: travelType(parsed.travel_type ?? source.travel_type),
      budget: nullableInteger(parsed.budget ?? source.budget, 0, 10_000_000),
      desired_food: uniqueText([...(stringArray(source.desired_food, 8, 40)), ...(parsed.desired_food ?? [])], 8),
      excluded_food: uniqueText(stringArray(source.excluded_food, 8, 40), 8),
      walking_preference: walkingPreference(parsed.walking_preference ?? source.walking_preference),
      weather: weather(parsed.weather ?? source.weather),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      must_visit_places: mustVisit,
      saved_places: saved,
      language,
      accessibility_requirements: stringArray(source.accessibility_requirements, 8, 60),
      luggage: typeof parsed.luggage === "boolean" ? parsed.luggage : source.luggage === true,
      desired_finish_location: source.desired_finish_location ? normalizeLocation(source.desired_finish_location, undefined, currentLocation.city_code) : null,
    },
    existing_itinerary: existing,
  };
}

export function parseNaturalTripRequest(text: string) {
  const normalized = text.normalize("NFKC").toLowerCase();
  const duration = normalized.match(/(\d{1,2})\s*(시간|hours?|小时|小時|時間)/i);
  const budget = normalized.match(/(?:예산|budget|预算|預算|予算)?\s*(\d{1,3}(?:[,\s]\d{3})+|\d{4,7})\s*(?:원|krw|₩)?/i);
  const party = normalized.match(/(\d{1,2})\s*(?:명|人|persons?|people)/i);
  const foods = [
    ["pork", /돼지고기|삼겹살|猪肉|豬肉|豚肉|pork/], ["seafood", /해산물|회|海鲜|海鮮|シーフード|seafood/],
    ["beef", /소고기|牛肉|beef/], ["chicken", /닭|치킨|鸡肉|鶏|chicken/], ["cafe", /카페|커피|咖啡|カフェ|coffee/],
  ] as const;
  const district = [
    ["busan", "haeundae-gu", /해운대|海云台|海雲台|ヘウンデ/], ["busan", "suyeong-gu", /광안리|수영구|广安里|廣安里|グァンアンリ/],
    ["busan", "busanjin-gu", /서면|부산진|西面|釜山镇|釜山鎮/], ["busan", "jung-gu", /남포|부산 중구/], ["busan", "yeongdo-gu", /영도|影岛|影島/],
    ["seoul", "gangnam-gu", /강남|江南|カンナム/], ["seoul", "mapo-gu", /홍대|마포|弘大|麻浦/], ["seoul", "jongno-gu", /종로|경복궁|钟路|鐘路/],
    ["seoul", "jung-gu", /명동|서울 중구|明洞/], ["jeju", "jeju-si", /제주시|济州市|済州市/], ["jeju", "seogwipo-si", /서귀포|西归浦|西帰浦/],
  ] as const satisfies ReadonlyArray<readonly [PlaceCity, string, RegExp]>;
  const districtMatch = district.find(([, , pattern]) => pattern.test(normalized));
  const explicitCity: PlaceCity | undefined = /서울|首尔|首爾|ソウル|seoul/.test(normalized) ? "seoul"
    : /제주|济州|濟州|済州|jeju/.test(normalized) ? "jeju"
      : /부산|釜山|busan/.test(normalized) ? "busan" : undefined;
  const cityCode = explicitCity ?? districtMatch?.[0];
  return {
    available_minutes: duration ? Number(duration[1]) * 60 : undefined,
    budget: budget ? Number(budget[1].replace(/[,\s]/g, "")) : undefined,
    party_size: party ? Number(party[1]) : undefined,
    desired_food: foods.filter(([, pattern]) => pattern.test(normalized)).map(([key]) => key),
    district_code: districtMatch?.[1],
    city_code: cityCode,
    walking_preference: /많이\s*걷기\S*\s*싫|적게 걷|少走|不想走|歩きたくない|less walk|avoid walking/.test(normalized) ? "low" as const : undefined,
    weather: /비|雨|rain/.test(normalized) ? "rain" as const : undefined,
    travel_type: /부모|父母|両親|parents?/.test(normalized) ? "parents" as const : /커플|情侣|情侶|カップル|couple/.test(normalized) ? "couple" as const : /혼자|一个人|一個人|ひとり|solo/.test(normalized) ? "solo" as const : undefined,
    luggage: /캐리어|짐|行李|スーツケース|luggage|suitcase/.test(normalized) || undefined,
  };
}

export function rankGroundedCandidates(places: PlaceWithRelations[], conditions: GroundedTripConditions, now = new Date()): RankedCandidate[] {
  const desired = conditions.desired_food.map(normalizeSearchToken).filter(Boolean);
  const excluded = conditions.excluded_food.map(normalizeSearchToken).filter(Boolean);
  const saved = new Set(conditions.saved_places);
  const must = new Set(conditions.must_visit_places);
  const origin = coordinates(conditions.current_location);

  return places.flatMap((place): RankedCandidate[] => {
    if (!isPublicPlace(place) || !isCityScopedPlace(place, conditions.current_location.city_code) || !hasCoordinates(place)) return [];
    if (!isReviewedForPlanning(place)) return [];
    const haystack = placeSearchText(place);
    if (excluded.some((term) => haystack.includes(term))) return [];
    if (desired.length && place.category !== "restaurant" && place.category !== "cafe" && !desired.some((term) => haystack.includes(term))) return [];
    if (conditions.budget !== null && place.price_min !== null && place.price_min > conditions.budget) return [];
    if (conditions.luggage && practical(place, "luggage_friendly") === "no") return [];
    if (conditions.accessibility_requirements.length && practical(place, "wheelchair_access") === "no" && practical(place, "elevator") === "no") return [];
    if (conditions.weather === "rain" && ["attraction", "photo_spot"].includes(place.category) && !place.decision_profile?.recommended_for.includes("rainy_day")) return [];

    const distance = origin ? calculateDistanceMeters(origin, { latitude: place.latitude, longitude: place.longitude }) : null;
    if (conditions.walking_preference === "low" && distance !== null && distance > 8_000 && !must.has(place.id)) return [];
    const matched: string[] = [];
    const unresolved: string[] = [];
    let score = 0;
    if (must.has(place.id)) { score += 1000; matched.push("must_visit"); }
    if (saved.has(place.id)) { score += 55; matched.push("saved_place"); }
    if (conditions.current_location.district_code && place.district_code === conditions.current_location.district_code) { score += 70; matched.push("current_area"); }
    if (desired.length && desired.some((term) => haystack.includes(term))) { score += 80; matched.push("desired_food"); }
    if (conditions.travel_type === "parents" && practical(place, "wheelchair_access") === "yes") { score += 20; matched.push("accessibility"); }
    if (conditions.luggage && practical(place, "luggage_friendly") === "yes") { score += 20; matched.push("luggage_friendly"); }
    if (conditions.weather === "rain" && place.decision_profile?.recommended_for.includes("rainy_day")) { score += 25; matched.push("rainy_day"); }
    if (distance !== null) score += Math.max(0, 45 - distance / 250);
    if (place.decision_profile?.verification_status === "verified") score += 20;
    if (conditions.budget !== null && place.price_min === null && place.price_max === null) unresolved.push("cost_unverified");
    if (conditions.luggage && practical(place, "luggage_friendly") === "unknown") unresolved.push("luggage_unverified");
    if (!place.operating_profile?.structured_operating_hours.length) unresolved.push("hours_unverified");
    return [{ place, score, matched, unresolved }];
  }).sort((a, b) => b.score - a.score);
}

export function validateAiSelection(selection: AiSelection, allowedIds: ReadonlySet<string>) {
  const ordered = uniqueIds(selection.ordered_place_ids).filter((id) => allowedIds.has(id));
  if (!ordered.length || ordered.length !== uniqueIds(selection.ordered_place_ids).length) throw new GroundedTripInputError("AI returned an unknown place ID.");
  return {
    ordered_place_ids: ordered.slice(0, 8),
    alternative_place_ids: uniqueIds(selection.alternative_place_ids ?? []).filter((id) => allowedIds.has(id) && !ordered.includes(id)).slice(0, 6),
  };
}

export function buildGroundedTripPlan(input: {
  places: PlaceWithRelations[];
  conditions: GroundedTripConditions;
  preferredOrderIds?: string[];
  source?: "rules" | "ai_ordered";
  now?: Date;
  existingItinerary?: ExistingItineraryStop[];
}): GroundedTripPlan {
  const start = new Date(input.conditions.start_time);
  const now = input.now ?? start;
  const ranked = rankGroundedCandidates(input.places, input.conditions, now);
  const rankedById = new Map(ranked.map((item) => [item.place.id, item]));
  const preferred = input.preferredOrderIds?.flatMap((id) => rankedById.get(id) ?? []) ?? [];
  const queue = uniqueCandidates([...preferred, ...ranked]);
  const selected: GroundedPlanPlace[] = [];
  const used = new Set<string>();
  let cursor = start;
  let previous: PlaceWithRelations | null = null;
  let totalWalking = 0;
  const globalUnresolved = new Set<string>();

  while (queue.length && selected.length < maxStops(input.conditions.available_minutes)) {
    const option = chooseNext(queue, used, previous, cursor, start, input.conditions);
    if (!option) break;
    const { candidate, travelMinutes, travelMode, distanceMeters, arrivalAt, state } = option;
    const stayMinutes = stayByCategory[candidate.place.category];
    const finish = new Date(arrivalAt.getTime() + stayMinutes * 60_000);
    if (finish.getTime() > new Date(input.conditions.end_time).getTime() + 5 * 60_000) {
      used.add(candidate.place.id);
      continue;
    }
    const alternatives = queue
      .filter((item) => item.place.id !== candidate.place.id && !used.has(item.place.id) && item.place.category === candidate.place.category)
      .slice(0, 3);
    const unresolved = [...candidate.unresolved];
    if (!state.hasStructuredData) unresolved.push("arrival_open_status_unverified");
    if (!candidate.matched.length) unresolved.push("preference_match_limited");
    unresolved.forEach((item) => globalUnresolved.add(item));
    const warnings = getTimeAwareNotices(state, input.conditions.language);
    if (state.code === "last_order_soon") warnings.unshift(timeWarning("last_order_soon", input.conditions.language));
    if (candidate.place.decision_profile?.primary_warning?.[input.conditions.language]) warnings.push(candidate.place.decision_profile.primary_warning[input.conditions.language] as string);
    const content = getPlaceContent(candidate.place, input.conditions.language);
    const estimatedCost = placeCost(candidate.place, input.conditions.party_size);
    const menuGuidance = menuGuidanceFor(candidate.place, input.conditions, arrivalAt);
    selected.push({
      id: candidate.place.id,
      slug: candidate.place.slug,
      name: content.name,
      korean_name: candidate.place.name_ko,
      address: content.address,
      category: candidate.place.category,
      latitude: Number(candidate.place.latitude),
      longitude: Number(candidate.place.longitude),
      thumbnail_url: candidate.place.thumbnail_url,
      arrival_time: arrivalAt.toISOString(),
      stay_minutes: stayMinutes,
      travel_minutes: travelMinutes,
      travel_mode: travelMode,
      distance_meters: distanceMeters,
      open_status: formatTimeAwarePrimary(state, input.conditions.language).text,
      open_status_code: state.code,
      recommendation_reason: recommendationReason(candidate, input.conditions.language),
      matched_conditions: candidate.matched,
      warnings: uniqueText(warnings, 8),
      alternative_place_ids: alternatives.map((item) => item.place.id),
      alternative_places: alternatives.map((item) => ({ id: item.place.id, slug: item.place.slug, name: getPlaceContent(item.place, input.conditions.language).name })),
      confidence: confidenceFor(candidate, state.hasStructuredData),
      unresolved_conditions: uniqueText(unresolved, 8),
      last_verified_at: candidate.place.decision_profile?.last_verified_at ?? candidate.place.last_verified_at ?? null,
      verification_status: candidate.place.decision_profile?.verification_status ?? candidate.place.china_info?.verification_status ?? "unverified",
      estimated_cost: estimatedCost,
      menu_guidance: menuGuidance,
    });
    used.add(candidate.place.id);
    if (travelMode === "walk") totalWalking += travelMinutes;
    previous = candidate.place;
    cursor = finish;
  }

  const recovery = buildRecovery(input.existingItinerary ?? [], input.places, selected, input.conditions, start);
  const costs = selected.map((item) => item.estimated_cost).filter((item): item is { min: number; max: number } => Boolean(item));
  if (costs.length !== selected.length) globalUnresolved.add("total_cost_incomplete");
  if (!selected.length) globalUnresolved.add("no_verified_open_candidate");
  const duration = selected.length ? Math.round((new Date(selected.at(-1)!.arrival_time).getTime() + selected.at(-1)!.stay_minutes * 60_000 - start.getTime()) / 60_000) : 0;
  return {
    route_title: routeTitle(input.conditions),
    total_duration: duration,
    total_cost_range: costs.length ? { min: costs.reduce((sum, cost) => sum + cost.min, 0), max: costs.reduce((sum, cost) => sum + cost.max, 0), currency: "KRW", complete: costs.length === selected.length } : null,
    total_walking_time: totalWalking,
    places: selected,
    confidence: selected.length && selected.every((item) => item.confidence === "high") ? "high" : selected.length ? "medium" : "low",
    unresolved_conditions: [...globalUnresolved],
    source: input.source ?? "rules",
    generated_at: now.toISOString(),
    conditions: input.conditions,
    recovery,
  };
}

function chooseNext(queue: RankedCandidate[], used: Set<string>, previous: PlaceWithRelations | null, cursor: Date, start: Date, conditions: GroundedTripConditions) {
  const origin = previous && hasCoordinates(previous)
    ? { latitude: previous.latitude, longitude: previous.longitude }
    : coordinates(conditions.current_location);
  const ranked = queue.flatMap((candidate) => {
    if (used.has(candidate.place.id)) return [];
    const target = { latitude: Number(candidate.place.latitude), longitude: Number(candidate.place.longitude) };
    const distanceMeters = origin ? calculateDistanceMeters(origin, target) : null;
    const walking = estimateWalkingMinutes(distanceMeters);
    const travelMode = conditions.walking_preference === "low" && (walking ?? 0) > 18 ? "taxi" as const : (walking ?? 0) > 35 ? "transit" as const : "walk" as const;
    const travelMinutes = distanceMeters === null ? 15 : travelMode === "walk" ? walking ?? 15 : travelMode === "taxi" ? Math.max(8, Math.round(distanceMeters / 450)) : Math.max(12, Math.round(distanceMeters / 300));
    const arrivalAt = new Date(cursor.getTime() + travelMinutes * 60_000);
    const elapsed = Math.round((arrivalAt.getTime() - start.getTime()) / 60_000);
    if (elapsed >= conditions.available_minutes) return [];
    const state = getTimeAwarePlaceState(candidate.place, { now: start, scheduledAt: arrivalAt, travelMinutes: elapsed });
    if (state.hasStructuredData && (blockedTimeCodes.has(state.code) || state.seasonAvailable === false)) return [];
    if (conditions.walking_preference === "low" && travelMode === "walk" && travelMinutes > 22) return [];
    const timeScore = state.recommendedAtArrival === true ? 35 : state.avoidAtArrival === true ? -40 : 0;
    const sequenceScore = previous ? transitionScore(previous.category, candidate.place.category) : firstStopScore(candidate.place.category, conditions);
    return [{ candidate, travelMinutes, travelMode, distanceMeters, arrivalAt, state, score: candidate.score + timeScore + sequenceScore - travelMinutes * 1.5 }];
  }).sort((a, b) => b.score - a.score);
  return ranked[0] ?? null;
}

function buildRecovery(existing: ExistingItineraryStop[], places: PlaceWithRelations[], plan: GroundedPlanPlace[], conditions: GroundedTripConditions, start: Date) {
  if (!existing.length) return { checked: false, issues: [], changes: [], before_place_ids: [] };
  const byId = new Map(places.map((place) => [place.id, place]));
  const issues = existing.flatMap((item) => {
    const place = byId.get(item.place_id);
    if (!place || !isPublicPlace(place) || !isCityScopedPlace(place, conditions.current_location.city_code)) return [{ place_id: item.place_id, reason_codes: ["place_unavailable"] }];
    const scheduledAt = item.planned_time ? withSeoulClock(start, item.planned_time) : start;
    const state = getTimeAwarePlaceState(place, { scheduledAt });
    const codes: string[] = state.hasStructuredData && blockedTimeCodes.has(state.code) ? [state.code] : [];
    if (conditions.weather === "rain" && ["attraction", "photo_spot"].includes(place.category) && !place.decision_profile?.recommended_for.includes("rainy_day")) codes.push("rain_conflict");
    return codes.length ? [{ place_id: item.place_id, reason_codes: codes }] : [];
  });
  const plannedIds = plan.map((item) => item.id);
  return {
    checked: true,
    issues,
    changes: issues.map((issue, index) => ({ from_place_id: issue.place_id, to_place_id: plannedIds[index] ?? null, reason_codes: issue.reason_codes })),
    before_place_ids: existing.map((item) => item.place_id),
  };
}

function menuGuidanceFor(place: PlaceWithRelations, conditions: GroundedTripConditions, arrivalAt: Date): GroundedPlanPlace["menu_guidance"] {
  const structured = place.menu_items.filter((item) => item.korean_original_name?.trim() || item.name_ko.trim());
  if (place.category !== "restaurant" || !structured.length) return null;
  const result = recommendMenuCombination(structured, {
    people: conditions.party_size, spicy: "okay", oily: "okay", seafood: "okay", cilantro: "okay",
    budget: conditions.budget, mealType: "meal", representativeFirst: true,
  }, conditions.language, arrivalAt);
  if (!result.lines.length) return null;
  return {
    items: result.lines.map((line) => ({ korean_name: line.item.korean_original_name?.trim() || line.item.name_ko, localized_name: line.item.localized_name?.[conditions.language] || line.item.name_ko, quantity: line.quantity, price: line.item.price })),
    total: result.total,
    warnings: result.warnings,
    korean_order_text: result.koreanOrderText,
  };
}

function isReviewedForPlanning(place: PlaceWithRelations) {
  if (isVerifiedPlace(place)) return true;
  if (place.status === "PUBLISHED") return place.decision_profile?.verification_status !== "rejected" && place.decision_profile?.verification_status !== "conflicting";
  return place.status === "ACTIVE" && place.china_info?.verification_status === "verified";
}

function practical(place: PlaceWithRelations, key: "luggage_friendly" | "wheelchair_access" | "elevator") {
  if (key === "luggage_friendly") return place.china_info?.luggage_friendly ?? (place.luggage_friendly ? "yes" : "unknown");
  return place.china_info?.[key] ?? "unknown";
}

function recommendationReason(candidate: RankedCandidate, locale: Locale) {
  const reasons: Record<string, Record<Locale, string>> = {
    must_visit: { ko: "꼭 가고 싶은 장소로 지정했습니다.", zh: "这是你指定的必去地点。", en: "You marked this as a must-visit.", ja: "必ず行きたい場所として指定されています。" },
    desired_food: { ko: "원하는 음식 조건과 확인된 장소 정보가 맞습니다.", zh: "与你想吃的食物及已确认地点信息相符。", en: "It matches your food preference and verified place data.", ja: "希望する食事条件と確認済み情報が一致します。" },
    saved_place: { ko: "이미 저장한 장소를 우선 반영했습니다.", zh: "优先使用了你已收藏的地点。", en: "A place you saved was prioritized.", ja: "保存済みの場所を優先しました。" },
    current_area: { ko: "현재 선택한 지역 안에서 이동 부담이 적습니다.", zh: "位于当前选择区域内，移动负担较小。", en: "It stays within your selected area.", ja: "選択中のエリア内で移動負担を抑えられます。" },
  };
  const key = ["must_visit", "desired_food", "saved_place", "current_area"].find((item) => candidate.matched.includes(item));
  return key ? reasons[key][locale] : { ko: "공개·검수 장소 중 시간과 이동 조건에 맞는 후보입니다.", zh: "这是符合时间与移动条件的公开审核地点。", en: "A reviewed public place matching the time and travel constraints.", ja: "時間と移動条件に合う公開・確認済み候補です。" }[locale];
}

function routeTitle(conditions: GroundedTripConditions) {
  const area = conditions.current_location.label || placeCityLabels[conditions.current_location.city_code][conditions.language];
  return {
    ko: `${area} ${conditions.available_minutes}분 실행 코스`, zh: `${area} ${conditions.available_minutes}分钟可执行路线`,
    en: `${conditions.available_minutes}-minute ${area} route`, ja: `${area} ${conditions.available_minutes}分実行コース`,
  }[conditions.language];
}

function confidenceFor(candidate: RankedCandidate, hasHours: boolean): "high" | "medium" | "low" {
  if (candidate.place.decision_profile?.verification_status === "verified" && hasHours) return "high";
  return candidate.place.status === "PUBLISHED" ? "medium" : "low";
}

function placeCost(place: PlaceWithRelations, partySize: number) {
  const min = place.price_min;
  const max = place.price_max;
  if (min === null && max === null) return null;
  const multiplier = place.category === "restaurant" || place.category === "cafe" || place.category === "bar" ? partySize : 1;
  return { min: (min ?? max ?? 0) * multiplier, max: (max ?? min ?? 0) * multiplier };
}

function placeSearchText(place: PlaceWithRelations) {
  return normalizeSearchToken([
    place.name_ko, place.name_zh, place.short_description_ko, place.short_description_zh,
    ...place.tags.flatMap((tag) => [tag.slug, tag.label_ko, tag.label_zh]),
    ...place.menu_items.flatMap((item) => [item.name_ko, item.name_zh, item.korean_original_name ?? "", ...Object.values(item.localized_name ?? {})]),
  ].join(" "));
}

function transitionScore(from: PlaceWithRelations["category"], to: PlaceWithRelations["category"]) {
  const good: Partial<Record<PlaceWithRelations["category"], PlaceWithRelations["category"][]>> = {
    cafe: ["attraction", "photo_spot", "restaurant"], attraction: ["cafe", "restaurant", "photo_spot"],
    restaurant: ["cafe", "attraction", "photo_spot", "bar"], photo_spot: ["cafe", "restaurant", "bar"],
  };
  return good[from]?.includes(to) ? 30 : from === to ? -10 : 5;
}

function firstStopScore(category: PlaceWithRelations["category"], conditions: GroundedTripConditions) {
  if (conditions.desired_food.length && category === "restaurant") return 45;
  return category === "attraction" || category === "cafe" ? 15 : 0;
}

function maxStops(minutes: number) { return minutes <= 180 ? 3 : minutes <= 360 ? 5 : 7; }
function coordinates(location: { latitude: number | null; longitude: number | null }) { return typeof location.latitude === "number" && typeof location.longitude === "number" ? { latitude: location.latitude, longitude: location.longitude } : null; }
function normalizeSearchToken(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); }
function uniqueCandidates(items: RankedCandidate[]) { const seen = new Set<string>(); return items.filter((item) => !seen.has(item.place.id) && Boolean(seen.add(item.place.id))); }
function uniqueIds(items: unknown[]) { return [...new Set(items.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item)))]; }
function uniqueText(items: string[], limit: number) { return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit); }
function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? [...value.normalize("NFKC")].map((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127 ? " " : character;
      }).join("").trim().slice(0, limit)
    : "";
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function integer(value: unknown, min: number, max: number, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback; }
function nullableInteger(value: unknown, min: number, max: number) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null; }
function validDate(value: unknown) { if (typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function locale(value: unknown): Locale { return value === "ko" || value === "en" || value === "ja" || value === "zh" ? value : "zh"; }
function travelType(value: unknown): GroundedTravelType { return value === "couple" || value === "parents" || value === "friends" ? value : "solo"; }
function walkingPreference(value: unknown): GroundedWalkingPreference { return value === "low" || value === "high" ? value : "normal"; }
function weather(value: unknown): GroundedWeather { return value === "rain" || value === "snow" ? value : "dry"; }
function stringArray(value: unknown, max: number, textLimit: number) { return Array.isArray(value) ? uniqueText(value.map((item) => cleanText(item, textLimit)), max) : []; }
function uuidArray(value: unknown, max: number) { return Array.isArray(value) ? uniqueIds(value).slice(0, max) : []; }
function normalizeLocation(value: unknown, fallbackDistrict?: string, forcedCity?: PlaceCity) {
  const row = record(value);
  const city = forcedCity ?? parsePlaceCity(cleanText(row.city_code, 20));
  const district = fallbackDistrict || cleanText(row.district_code, 30);
  return {
    label: cleanText(row.label, 80),
    city_code: city,
    district_code: cityRegions(city).some((item) => item.key === district) ? district : null,
    latitude: roundedCoordinate(row.latitude, -90, 90),
    longitude: roundedCoordinate(row.longitude, -180, 180),
  };
}
function roundedCoordinate(value: unknown, min: number, max: number) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= min && parsed <= max ? Math.round(parsed * 10_000) / 10_000 : null; }
function normalizeExistingStop(value: unknown): ExistingItineraryStop[] { const row = record(value); const id = cleanText(row.place_id, 40); if (!/^[0-9a-f-]{36}$/i.test(id)) return []; const time = cleanText(row.planned_time, 5); return [{ place_id: id, planned_time: /^\d{2}:\d{2}$/.test(time) ? time : null, stay_minutes: nullableInteger(row.stay_minutes, 0, 1440) }]; }
function withSeoulClock(base: Date, time: string) { const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(base); return new Date(`${date}T${time}:00+09:00`); }
function timeWarning(code: string, locale: Locale) { return code === "last_order_soon" ? { ko: "라스트오더가 임박했습니다.", zh: "即将停止点餐。", en: "Last order is approaching.", ja: "ラストオーダーが近づいています。" }[locale] : ""; }
