import { isValidCoordinates } from "@/lib/location";
import type {
  PlaceCategory,
  PlaceChinaInfoRecord,
  PlaceFactTristate,
  PlaceMenuItem,
  PlacePayload,
  PlaceRecord,
  PlaceSourceRecord,
  PlaceWithRelations,
} from "@/types/database";

export const staleVerificationDays = 180;
const supportedStatuses = new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED", "ACTIVE", "INACTIVE"]);

export type PlaceQualityItemKey =
  | "status"
  | "name_ko"
  | "name_zh"
  | "category"
  | "address"
  | "coordinates"
  | "thumbnail"
  | "description"
  | "opening_hours"
  | "recommended_menu"
  | "recommended_menu_price"
  | "price_range"
  | "waiting"
  | "card_payment"
  | "solo_friendly"
  | "toilet"
  | "luggage"
  | "chinese_support"
  | "traveler_advantage"
  | "traveler_caution"
  | "source"
  | "last_verified_at"
  | "closed_days";

export type PlaceQualityItem = {
  key: PlaceQualityItemKey;
  label: string;
  required: boolean;
  ok: boolean;
  reason: string;
};

export type PlaceQualityResult = {
  score: number;
  required: PlaceQualityItem[];
  optional: PlaceQualityItem[];
  missingRequired: PlaceQualityItem[];
  missingOptional: PlaceQualityItem[];
  canPublish: boolean;
  isStale: boolean;
  lastVerifiedAt: string | null;
};

type QualityPlace = Partial<PlaceRecord> & {
  category?: PlaceCategory | "";
  menu_items?: Array<Partial<PlaceMenuItem>>;
  china_info?: Partial<PlaceChinaInfoRecord> | null;
  sources?: Array<Partial<PlaceSourceRecord>>;
  source?: PlacePayload["source"];
  translations?: PlaceWithRelations["translations"] | PlacePayload["translations"];
  last_verified_at?: string | null;
  closed_days?: string | null;
};

const foodCategories: PlaceCategory[] = ["restaurant", "cafe", "bar"];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function tristateKnown(value: unknown): value is Exclude<PlaceFactTristate, "unknown"> {
  return value === "yes" || value === "no";
}

function hasAnySource(place: QualityPlace) {
  return Boolean(
    place.sources?.some((source) => text(source.source_url) || text(source.external_id)) ||
      text(place.source?.source_url) ||
      text(place.source?.external_id) ||
      text(place.website),
  );
}

function sourceLastSynced(place: QualityPlace) {
  return place.sources?.map((source) => source.last_synced_at).find((value): value is string => Boolean(value)) ??
    place.source?.last_synced_at ??
    null;
}

function lastVerifiedAt(place: QualityPlace) {
  return text(place.last_verified_at) || text(place.china_info?.verified_at) || sourceLastSynced(place);
}

function isDateStale(value: string | null, now = new Date()) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  return now.getTime() - time > staleVerificationDays * 24 * 60 * 60 * 1000;
}

function hasRecommendedMenu(place: QualityPlace) {
  return Boolean(place.menu_items?.some((item) => item.is_recommended && (text(item.name_ko) || text(item.name_zh))));
}

function hasRecommendedMenuPrice(place: QualityPlace) {
  return Boolean(place.menu_items?.some((item) => item.is_recommended && typeof item.price === "number" && item.price >= 0));
}

function hasPriceRange(place: QualityPlace) {
  return (
    typeof place.price_level === "number" ||
    typeof place.price_min === "number" ||
    typeof place.price_max === "number"
  );
}

function hasTravelerAdvantage(place: QualityPlace) {
  return Boolean(
    text(place.china_info?.manual_summary_override) ||
      typeof place.china_info?.chinese_taste_score === "number" ||
      tristateKnown(place.china_info?.tourism_recommended) ||
      tristateKnown(place.china_info?.photo_recommended) ||
      text(place.tips_zh),
  );
}

function hasTravelerCaution(place: QualityPlace) {
  return Boolean(
    text(place.china_info?.manual_warning_override) ||
      text(place.tips_zh) ||
      place.china_info?.waiting_level === "long" ||
      place.china_info?.waiting_level === "extreme" ||
      place.china_info?.minimum_order_policy === "two_plus" ||
      place.china_info?.minimum_order_policy === "three_plus" ||
      place.china_info?.minimum_order_policy === "other",
  );
}

function isFoodCategory(place: QualityPlace) {
  return foodCategories.includes(place.category as PlaceCategory);
}

function qualityItem(key: PlaceQualityItemKey, label: string, required: boolean, ok: boolean, reason: string): PlaceQualityItem {
  return { key, label, required, ok, reason };
}

export function evaluatePlaceQuality(place: QualityPlace, now = new Date()): PlaceQualityResult {
  const lastVerified = lastVerifiedAt(place);
  const isFood = isFoodCategory(place);
  const required = [
    qualityItem("status", "상태값", true, supportedStatuses.has(text(place.status)), "DRAFT, REVIEW, PUBLISHED, ARCHIVED 중 하나가 필요합니다."),
    qualityItem("name_ko", "한국어 장소명", true, Boolean(text(place.name_ko)), "한국어 장소명이 필요합니다."),
    qualityItem("name_zh", "중국어 장소명", true, Boolean(text(place.name_zh)), "중국어 장소명이 필요합니다."),
    qualityItem("category", "카테고리", true, Boolean(place.category), "카테고리를 선택해야 합니다."),
    qualityItem("address", "주소", true, Boolean(text(place.address_ko) || text(place.address_zh) || text(place.address)), "주소가 필요합니다."),
    qualityItem("coordinates", "위도·경도", true, isValidCoordinates({ latitude: place.latitude, longitude: place.longitude }), "정상 범위의 위도·경도가 필요합니다."),
    qualityItem("thumbnail", "대표사진", true, Boolean(text(place.thumbnail_url)), "대표 사진 URL이 필요합니다."),
    qualityItem("description", "대표 설명", true, Boolean(text(place.short_description_ko) && text(place.short_description_zh)), "한국어와 중국어 대표 설명이 필요합니다."),
    qualityItem("opening_hours", "영업시간", true, Boolean(text(place.opening_hours)), "영업시간이 필요합니다."),
    qualityItem("source", "정보 출처", true, hasAnySource(place), "지도 링크, 외부 ID, 공식 웹사이트 중 하나가 필요합니다."),
    qualityItem("last_verified_at", "마지막 확인일", true, Boolean(lastVerified), "마지막 확인일 또는 출처 동기화 시간이 필요합니다."),
    ...(isFood
      ? [
          qualityItem("recommended_menu", "대표 메뉴", true, hasRecommendedMenu(place), "음식점·카페·바는 대표 메뉴가 필요합니다."),
          qualityItem("recommended_menu_price", "대표 메뉴 가격", true, hasRecommendedMenuPrice(place), "대표 메뉴 가격이 필요합니다."),
          qualityItem("price_range", "가격대", true, hasPriceRange(place), "가격대 또는 최소·최대 가격이 필요합니다."),
          qualityItem("waiting", "웨이팅", true, place.china_info?.waiting_level !== undefined && place.china_info.waiting_level !== "unknown", "웨이팅 정보를 확인해야 합니다."),
          qualityItem("card_payment", "카드 결제", true, tristateKnown(place.china_info?.foreign_card) || typeof place.card_payment === "boolean", "카드 결제 가능 여부를 확인해야 합니다."),
          qualityItem("solo_friendly", "혼밥", true, tristateKnown(place.china_info?.solo_friendly) || typeof place.solo_friendly === "boolean", "혼밥 가능 여부를 확인해야 합니다."),
        ]
      : []),
  ];
  const optional = [
    qualityItem("closed_days", "휴무일", false, Boolean(text(place.closed_days)), "휴무일을 확인하면 신뢰도가 높아집니다."),
    qualityItem("toilet", "화장실", false, tristateKnown(place.china_info?.toilet_available), "화장실 이용 가능 여부가 필요합니다."),
    qualityItem("luggage", "큰 캐리어 가능 여부", false, tristateKnown(place.china_info?.luggage_friendly) || typeof place.luggage_friendly === "boolean", "큰 캐리어 동반 가능 여부가 필요합니다."),
    qualityItem("chinese_support", "중국어 메뉴 또는 응대", false, tristateKnown(place.china_info?.chinese_menu) || tristateKnown(place.china_info?.chinese_service) || typeof place.chinese_menu === "boolean", "중국어 메뉴 또는 응대 가능 여부가 필요합니다."),
    qualityItem("traveler_advantage", "중국인 여행객 장점", false, hasTravelerAdvantage(place), "중국인 여행객 기준 장점을 정리해야 합니다."),
    qualityItem("traveler_caution", "중국인 여행객 주의점", false, hasTravelerCaution(place), "방문 전 주의점을 정리해야 합니다."),
  ];
  const requiredPassed = required.filter((item) => item.ok).length;
  const optionalPassed = optional.filter((item) => item.ok).length;
  const requiredScore = required.length ? (requiredPassed / required.length) * 70 : 70;
  const optionalScore = optional.length ? (optionalPassed / optional.length) * 30 : 30;

  return {
    score: Math.round(requiredScore + optionalScore),
    required,
    optional,
    missingRequired: required.filter((item) => !item.ok),
    missingOptional: optional.filter((item) => !item.ok),
    canPublish: required.every((item) => item.ok),
    isStale: isDateStale(lastVerified, now),
    lastVerifiedAt: lastVerified,
  };
}

export function formatQualityBlockMessage(result: PlaceQualityResult) {
  return result.missingRequired.map((item) => `${item.label}: ${item.reason}`).join("\n");
}
