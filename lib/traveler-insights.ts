import type {
  PlaceChinaInfoRecord,
  PlaceFactTristate,
  TravelerInsightIntensity,
  TravelerInsightOrderingMethod,
  TravelerInsightPortion,
  TravelerInsightPossibility,
  TravelerInsightReservation,
  TravelerInsights,
  TravelerInsightToilet,
  TravelerInsightWaiting,
} from "@/types/database";

export const travelerInfoStaleAfterDays = 180;

export function createEmptyTravelerInsights(): Required<TravelerInsights> {
  return {
    solo_dining: "unknown",
    card_payment: "unknown",
    cash_required: "unknown",
    chinese_menu: "unknown",
    english_menu: "unknown",
    ordering_method: "unknown",
    reservation: "unknown",
    waiting: "unknown",
    luggage_storage: "unknown",
    toilet: "unknown",
    spicy: "unknown",
    cilantro: "unknown",
    spice_intensity: "unknown",
    portion: "unknown",
    greasiness: "unknown",
    tourist_friendly: "unknown",
  };
}

export function normalizeTravelerInsights(value: unknown): Required<TravelerInsights> {
  const input = isRecord(value) ? value : {};
  const empty = createEmptyTravelerInsights();

  return {
    solo_dining: oneOf(input.solo_dining, tristates, empty.solo_dining),
    card_payment: oneOf(input.card_payment, tristates, empty.card_payment),
    cash_required: oneOf(input.cash_required, tristates, empty.cash_required),
    chinese_menu: oneOf(input.chinese_menu, tristates, empty.chinese_menu),
    english_menu: oneOf(input.english_menu, tristates, empty.english_menu),
    ordering_method: oneOf(input.ordering_method, orderingMethods, empty.ordering_method),
    reservation: oneOf(input.reservation, reservations, empty.reservation),
    waiting: oneOf(input.waiting, waitingLevels, empty.waiting),
    luggage_storage: oneOf(input.luggage_storage, tristates, empty.luggage_storage),
    toilet: oneOf(input.toilet, toilets, empty.toilet),
    spicy: oneOf(input.spicy, intensities, empty.spicy),
    cilantro: oneOf(input.cilantro, possibilities, empty.cilantro),
    spice_intensity: oneOf(input.spice_intensity, intensities, empty.spice_intensity),
    portion: oneOf(input.portion, portions, empty.portion),
    greasiness: oneOf(input.greasiness, possibilities, empty.greasiness),
    tourist_friendly: oneOf(input.tourist_friendly, tristates, empty.tourist_friendly),
  };
}

export function travelerInsightsFromPlaceInfo(
  info: Pick<
    PlaceChinaInfoRecord,
    | "traveler_insights"
    | "solo_friendly"
    | "foreign_card"
    | "chinese_menu"
    | "luggage_friendly"
    | "toilet_available"
    | "reservation_required"
    | "waiting_level"
    | "spicy_level"
    | "greasy_level"
    | "portion_level"
    | "tourism_recommended"
  > | null | undefined,
) {
  const normalized = normalizeTravelerInsights(info?.traveler_insights);
  if (!info) return normalized;
  const stored = isRecord(info.traveler_insights) ? info.traveler_insights : {};

  return {
    ...normalized,
    solo_dining: hasOwn(stored, "solo_dining") ? normalized.solo_dining : info.solo_friendly,
    card_payment: hasOwn(stored, "card_payment") ? normalized.card_payment : info.foreign_card,
    chinese_menu: hasOwn(stored, "chinese_menu") ? normalized.chinese_menu : info.chinese_menu,
    luggage_storage: hasOwn(stored, "luggage_storage") ? normalized.luggage_storage : info.luggage_friendly,
    toilet: hasOwn(stored, "toilet")
      ? normalized.toilet
      : info.toilet_available === "yes"
        ? "available"
        : info.toilet_available === "no"
          ? "none"
          : "unknown",
    reservation: hasOwn(stored, "reservation")
      ? normalized.reservation
      : info.reservation_required === "yes"
        ? "required"
        : info.reservation_required === "no"
          ? "not_needed"
          : "unknown",
    waiting: hasOwn(stored, "waiting") ? normalized.waiting : mapLegacyWaiting(info.waiting_level),
    spicy: hasOwn(stored, "spicy") ? normalized.spicy : mapLegacyLevel(info.spicy_level),
    greasiness: hasOwn(stored, "greasiness") ? normalized.greasiness : mapLegacyPossibility(info.greasy_level),
    portion: hasOwn(stored, "portion") ? normalized.portion : mapLegacyPortion(info.portion_level),
    tourist_friendly: hasOwn(stored, "tourist_friendly") ? normalized.tourist_friendly : info.tourism_recommended,
  } satisfies Required<TravelerInsights>;
}

export function hasVisibleTravelerInsights(insights: TravelerInsights | null | undefined) {
  const value = normalizeTravelerInsights(insights);
  return Object.values(value).some((item) => item !== "unknown");
}

export function isPlaceInformationStale(verifiedAt: string | null | undefined, now = new Date()) {
  if (!verifiedAt) return false;
  const verifiedTime = Date.parse(verifiedAt);
  if (!Number.isFinite(verifiedTime)) return false;
  return now.getTime() - verifiedTime > travelerInfoStaleAfterDays * 24 * 60 * 60 * 1000;
}

export function verificationDateLabel(verifiedAt: string | null | undefined, locale: string) {
  if (!verifiedAt) return "";
  const date = new Date(verifiedAt);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  if (locale === "ko") return `${formatted} 정보 확인`;
  if (locale === "zh") return `${formatted} 信息已确认`;
  if (locale === "ja") return `${formatted} 情報確認`;
  return `Information checked ${formatted}`;
}

const tristates = ["yes", "no", "unknown"] as const satisfies readonly PlaceFactTristate[];
const orderingMethods = ["unknown", "kiosk", "staff", "both"] as const satisfies readonly TravelerInsightOrderingMethod[];
const reservations = ["unknown", "not_needed", "recommended", "required"] as const satisfies readonly TravelerInsightReservation[];
const waitingLevels = ["unknown", "none", "some", "high"] as const satisfies readonly TravelerInsightWaiting[];
const toilets = ["unknown", "available", "inside", "none"] as const satisfies readonly TravelerInsightToilet[];
const intensities = ["unknown", "normal", "strong"] as const satisfies readonly TravelerInsightIntensity[];
const possibilities = ["unknown", "no", "possible"] as const satisfies readonly TravelerInsightPossibility[];
const portions = ["unknown", "regular", "large"] as const satisfies readonly TravelerInsightPortion[];

function oneOf<const Value extends string>(value: unknown, values: readonly Value[], fallback: Value): Value {
  return typeof value === "string" && values.includes(value as Value) ? value as Value : fallback;
}

function mapLegacyWaiting(value: PlaceChinaInfoRecord["waiting_level"]): TravelerInsightWaiting {
  if (value === "none") return "none";
  if (value === "short" || value === "moderate" || value === "varies") return "some";
  if (value === "long" || value === "extreme") return "high";
  return "unknown";
}

function mapLegacyLevel(value: number | null): TravelerInsightIntensity {
  if (value === null) return "unknown";
  return value >= 4 ? "strong" : "normal";
}

function mapLegacyPossibility(value: number | null): TravelerInsightPossibility {
  if (value === null) return "unknown";
  return value >= 4 ? "possible" : "no";
}

function mapLegacyPortion(value: number | null): TravelerInsightPortion {
  if (value === null) return "unknown";
  return value >= 4 ? "large" : "regular";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
