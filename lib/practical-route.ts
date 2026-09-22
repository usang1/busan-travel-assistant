import { calculateDistanceMeters, estimateWalkingMinutes, hasCoordinates } from "@/lib/location";
import { getTimeAwarePlaceState, type TimeAwarePlaceState } from "@/lib/time-aware-place";
import type { Locale } from "@/lib/i18n";
import type { PlaceCategory, PlaceWithRelations } from "@/types/database";
import type { PlaceConnection, TravelerTheme } from "@/types/traveler-decision";

export type RouteWeather = "dry" | "rain";
export type RouteParty = "solo" | "couple" | "parents";
export type RoutePurpose = "auto" | "food" | "cafe" | "photo" | "night";
export type RoutePreferences = {
  currentStayMinutes: number;
  weather: RouteWeather;
  party: RouteParty;
  lowWalking: boolean;
  purpose: RoutePurpose;
};

export type PublicPlaceConnection = PlaceConnection & { from_place_id: string };
export type PracticalRouteStop = {
  place: PlaceWithRelations;
  source: "manual" | "rule";
  reason: string;
  distanceMeters: number | null;
  travelMinutes: number | null;
  travelMode: PlaceConnection["travel_mode"];
  arrivalAt: Date;
  stayMinutes: number;
  timeState: TimeAwarePlaceState;
};
export type PracticalRoute = { stops: PracticalRouteStop[]; totalMinutes: number };

const blockedTimeCodes = new Set(["closes_before_arrival", "after_last_order", "closed_today", "temporary_closed"]);
const categoryStay: Record<PlaceCategory, number> = {
  restaurant: 45, cafe: 30, bar: 45, attraction: 30, shopping: 30, photo_spot: 20, luggage: 15,
};

export function buildPracticalRoute(input: {
  origin: PlaceWithRelations;
  candidates: PlaceWithRelations[];
  connections: PublicPlaceConnection[];
  locale: Locale;
  preferences: RoutePreferences;
  savedPlaceIds?: ReadonlySet<string>;
  now?: Date;
  limitMinutes?: number;
}): PracticalRoute {
  const now = input.now ?? new Date();
  const limit = input.limitMinutes ?? 90;
  const candidates = new Map(input.candidates.filter((place) => place.id !== input.origin.id).map((place) => [place.id, place]));
  const used = new Set([input.origin.id]);
  const stops: PracticalRouteStop[] = [];
  let elapsed = Math.max(0, input.preferences.currentStayMinutes);
  let current = input.origin;

  while (stops.length < 2 && elapsed < limit) {
    const ranked = [...candidates.values()]
      .filter((place) => !used.has(place.id))
      .flatMap((place) => {
        const option = scoreCandidate(current, place, input.connections, input.preferences, input.locale, input.savedPlaceIds, now, elapsed, limit);
        return option ? [option] : [];
      })
      .sort((a, b) => b.score - a.score || (a.stop.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.stop.distanceMeters ?? Number.MAX_SAFE_INTEGER));
    const selected = ranked[0]?.stop;
    if (!selected) break;
    stops.push(selected);
    used.add(selected.place.id);
    elapsed = Math.round((selected.arrivalAt.getTime() - now.getTime()) / 60_000) + selected.stayMinutes;
    current = selected.place;
  }

  return { stops, totalMinutes: Math.min(limit, elapsed) };
}

function scoreCandidate(
  from: PlaceWithRelations,
  place: PlaceWithRelations,
  connections: PublicPlaceConnection[],
  preferences: RoutePreferences,
  locale: Locale,
  savedPlaceIds: ReadonlySet<string> | undefined,
  now: Date,
  elapsed: number,
  limit: number,
) {
  const edge = connections.find((item) => item.from_place_id === from.id && item.to_place_id === place.id && item.active);
  const distanceMeters = edge?.travel_distance ?? distanceBetween(from, place);
  const walkingMinutes = estimateWalkingMinutes(distanceMeters);
  const travelMinutes = edge?.travel_minutes ?? walkingMinutes;
  if (travelMinutes === null || (preferences.lowWalking && (edge?.travel_mode ?? "walk") === "walk" && distanceMeters !== null && distanceMeters > 1200)) return null;
  if (preferences.weather === "rain" && !edge && !["restaurant", "cafe", "shopping", "luggage"].includes(place.category)) return null;
  if (preferences.party === "parents" && place.china_info?.wheelchair_access === "no" && place.china_info?.elevator === "no") return null;

  const stayMinutes = categoryStay[place.category];
  const arrivalMinute = elapsed + travelMinutes;
  if (arrivalMinute >= limit || arrivalMinute + Math.min(stayMinutes, 15) > limit) return null;
  const arrivalAt = new Date(now.getTime() + arrivalMinute * 60_000);
  if (edge && !edgeMatches(edge, preferences, arrivalAt)) return null;
  const timeState = getTimeAwarePlaceState(place, { now, scheduledAt: arrivalAt, travelMinutes: arrivalMinute });
  if (timeState.hasStructuredData && blockedTimeCodes.has(timeState.code)) return null;
  if (timeState.seasonAvailable === false) return null;

  const transition = transitionScore(from.category, place.category, preferences.purpose);
  const manualScore = edge ? 100 + edge.priority : 0;
  const savedScore = savedPlaceIds?.has(place.id) ? 16 : 0;
  const regionScore = from.district_code && place.district_code === from.district_code ? 12 : 0;
  const timeScore = timeState.recommendedAtArrival === true ? 16 : timeState.avoidAtArrival ? -25 : 0;
  const walkPenalty = Math.min(24, Math.round(travelMinutes / (preferences.lowWalking ? 2 : 4)));
  const reason = edge?.sequence_reason?.[locale]?.trim() || ruleReason(from.category, place.category, preferences, locale);

  return {
    score: manualScore + transition + savedScore + regionScore + timeScore - walkPenalty,
    stop: {
      place, source: edge ? "manual" as const : "rule" as const, reason,
      distanceMeters, travelMinutes, travelMode: edge?.travel_mode ?? "walk",
      arrivalAt, stayMinutes, timeState,
    },
  };
}

function edgeMatches(edge: PublicPlaceConnection, preferences: RoutePreferences, now: Date) {
  if (edge.weather_conditions.length) {
    const wanted = preferences.weather === "rain" ? ["rain", "rainy", "indoor"] : ["dry", "sunny", "any"];
    if (!edge.weather_conditions.some((value) => wanted.includes(value.toLowerCase()))) return false;
  }
  const partyTheme: Partial<Record<RouteParty, TravelerTheme>> = { solo: "solo", couple: "couple", parents: "parents" };
  if (edge.trip_theme.length && partyTheme[preferences.party] && !edge.trip_theme.includes(partyTheme[preferences.party]!)) return false;
  if (!edge.valid_time_ranges.length) return true;
  const parts = seoulParts(now);
  return edge.valid_time_ranges.some((range) => {
    if (!range.weekdays.includes(parts.weekday)) return false;
    const minute = parts.hour * 60 + parts.minute;
    const start = clockMinutes(range.start);
    const end = clockMinutes(range.end);
    return start <= end ? minute >= start && minute <= end : minute >= start || minute <= end;
  });
}

function transitionScore(from: PlaceCategory, to: PlaceCategory, purpose: RoutePurpose) {
  if (purpose !== "auto") {
    const matches = purpose === "food" ? ["restaurant"] : purpose === "cafe" ? ["cafe"] : purpose === "photo" ? ["photo_spot", "attraction"] : ["bar", "photo_spot", "attraction"];
    return matches.includes(to) ? 35 : -5;
  }
  const preferred: Partial<Record<PlaceCategory, PlaceCategory[]>> = {
    cafe: ["attraction", "photo_spot", "restaurant"],
    attraction: ["cafe", "photo_spot", "restaurant"],
    photo_spot: ["cafe", "restaurant", "bar"],
    restaurant: ["attraction", "photo_spot", "cafe", "bar"],
    bar: ["photo_spot", "attraction"],
  };
  return preferred[from]?.includes(to) ? 24 : 5;
}

function ruleReason(from: PlaceCategory, to: PlaceCategory, preferences: RoutePreferences, locale: Locale) {
  if (preferences.weather === "rain") return { ko: "비 오는 날 이동이 짧은 실내 후보", zh: "雨天优先的短距离室内候选", en: "Short indoor option for rainy weather", ja: "雨の日向けの近い屋内候補" }[locale];
  if (preferences.lowWalking) return { ko: "걷는 거리를 줄인 가까운 후보", zh: "减少步行距离的附近候选", en: "Nearby option with less walking", ja: "歩く距離を抑えた近隣候補" }[locale];
  const key = `${from}:${to}`;
  const reasons: Record<string, Record<Locale, string>> = {
    "cafe:attraction": { ko: "카페 다음 산책·관광 흐름", zh: "咖啡后适合散步或观光", en: "A walk or sight after the cafe", ja: "カフェの後の散策・観光向け" },
    "cafe:photo_spot": { ko: "카페 다음 사진 동선", zh: "咖啡后接拍照路线", en: "A photo stop after the cafe", ja: "カフェの後の撮影スポット" },
    "restaurant:photo_spot": { ko: "식사 뒤 가볍게 보는 야경·사진 후보", zh: "用餐后适合夜景或拍照", en: "A light photo or night-view stop after the meal", ja: "食後の夜景・撮影候補" },
    "attraction:cafe": { ko: "관광 뒤 쉬어가기 좋은 카페 후보", zh: "观光后适合休息的咖啡店", en: "A cafe break after sightseeing", ja: "観光後に休めるカフェ候補" },
  };
  return reasons[key]?.[locale] ?? { ko: "거리와 방문 순서를 고려한 자동 후보", zh: "按距离和游览顺序筛选的自动候选", en: "Rule-based option using distance and visit order", ja: "距離と訪問順を考慮した自動候補" }[locale];
}

function distanceBetween(a: PlaceWithRelations, b: PlaceWithRelations) {
  if (!hasCoordinates(a) || !hasCoordinates(b)) return null;
  return calculateDistanceMeters({ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude });
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function seoulParts(date: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdays[parts.weekday] ?? 0, hour: Number(parts.hour), minute: Number(parts.minute) };
}
