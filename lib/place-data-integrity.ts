import type {
  PlaceCategory,
  PlaceFactTristate,
  PlaceMenuItem,
  PlaceRecord,
  PlaceWithRelations,
} from "@/types/database";

export const minimumNormalMenuPrice = 1_000;
export const maximumPriceTier = 4;

const foodAndDrinkCategories = new Set<PlaceCategory>(["restaurant", "cafe", "bar"]);
const tristateValues = new Set<PlaceFactTristate>(["yes", "no", "unknown"]);

export type NormalizedPlacePricing = {
  priceTier: number | null;
  priceMin: number | null;
  priceMax: number | null;
  issues: string[];
};

export type PlaceFactKey = "card_payment" | "solo_friendly" | "chinese_menu" | "luggage_friendly" | "toilet";

export type PlaceDataIssue = {
  code:
    | "invalid_price_tier"
    | "invalid_price_min"
    | "invalid_price_max"
    | "reversed_price_range"
    | "invalid_menu_price"
    | "legacy_boolean_without_tristate"
    | "missing_chinese_name"
    | "mixed_korean_in_chinese_copy"
    | "romanized_chinese_address";
  field: string;
  detail: string;
};

export function normalizePriceTier(value: unknown): number | null {
  if (typeof value === "string") {
    const trimmed = value.normalize("NFKC").trim();
    if (/^₩{1,4}$/.test(trimmed)) return trimmed.length;
    if (!/^\d+$/.test(trimmed)) return null;
    value = Number(trimmed);
  }

  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximumPriceTier
    ? value
    : null;
}

export function normalizeMenuPrice(value: unknown): number | null {
  const amount = finiteInteger(value);
  if (amount === null || amount < 0) return null;
  if (amount === 0) return 0;
  return amount >= minimumNormalMenuPrice ? amount : null;
}

export function normalizePlacePriceAmount(value: unknown, category?: PlaceCategory | null): number | null {
  const amount = finiteInteger(value);
  if (amount === null || amount < 0) return null;
  if (amount === 0) return 0;
  if (category && foodAndDrinkCategories.has(category) && amount < minimumNormalMenuPrice) return null;
  return amount;
}

export function normalizePlacePricing(
  place: Pick<PlaceRecord, "price_level" | "price_min" | "price_max"> & { category?: PlaceCategory | null },
): NormalizedPlacePricing {
  const issues: string[] = [];
  const legacyTierValues = [place.price_min, place.price_max]
    .map(normalizePriceTier)
    .filter((value): value is number => value !== null && value > 0);
  let priceTier = normalizePriceTier(place.price_level);

  if (priceTier === null && legacyTierValues.length && foodAndDrinkCategories.has(place.category as PlaceCategory)) {
    priceTier = Math.max(...legacyTierValues);
  }

  let priceMin = normalizePlacePriceAmount(place.price_min, place.category);
  let priceMax = normalizePlacePriceAmount(place.price_max, place.category);

  if (place.price_level !== null && place.price_level !== undefined && priceTier === null) issues.push("invalid_price_tier");
  if (place.price_min !== null && priceMin === null) issues.push("invalid_price_min");
  if (place.price_max !== null && priceMax === null) issues.push("invalid_price_max");

  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    priceMin = null;
    priceMax = null;
    issues.push("reversed_price_range");
  }

  return { priceTier, priceMin, priceMax, issues };
}

export function normalizeTristate(value: unknown): PlaceFactTristate {
  return tristateValues.has(value as PlaceFactTristate) ? value as PlaceFactTristate : "unknown";
}

export function resolvePlaceFact(place: Pick<PlaceWithRelations, "china_info" | "card_payment" | "solo_friendly" | "chinese_menu" | "luggage_friendly">, key: PlaceFactKey): PlaceFactTristate {
  const structured = key === "card_payment"
    ? place.china_info?.foreign_card
    : key === "solo_friendly"
      ? place.china_info?.solo_friendly
      : key === "chinese_menu"
        ? place.china_info?.chinese_menu
        : key === "luggage_friendly"
          ? place.china_info?.luggage_friendly
          : place.china_info?.toilet_available;
  const normalized = normalizeTristate(structured);

  if (normalized !== "unknown") return normalized;
  if (key === "toilet") return "unknown";

  const legacyTrue = key === "card_payment"
    ? place.card_payment === true
    : key === "solo_friendly"
      ? place.solo_friendly === true
      : key === "chinese_menu"
        ? place.chinese_menu === true
        : place.luggage_friendly === true;

  // Legacy false values came from non-null boolean defaults, so only true is usable evidence.
  return legacyTrue ? "yes" : "unknown";
}

export function isUsableChineseAddress(value: unknown) {
  if (typeof value !== "string") return false;
  const text = value.normalize("NFKC").trim();
  if (!text || !/[\u3400-\u9fff]/u.test(text) || /[가-힣]/u.test(text)) return false;
  return !/(?:^|\s)[A-Za-z]+(?:[-\s][A-Za-z0-9]+)*(?:-ro|-gil|\s(?:ro|gil|road|street|avenue))\b|\b(?:Busan|Seoul|Jeju|Korea)\b/i.test(text);
}

export function hasChineseTranslation(value: unknown, koreanOriginal: unknown) {
  if (typeof value !== "string") return false;
  const translated = value.normalize("NFKC").trim();
  const korean = typeof koreanOriginal === "string" ? koreanOriginal.normalize("NFKC").trim() : "";
  return Boolean(translated && translated !== korean && !/[\uac00-\ud7a3]/u.test(translated));
}

export function diagnosePlaceData(place: Partial<PlaceWithRelations>): PlaceDataIssue[] {
  const issues: PlaceDataIssue[] = [];
  const pricing = normalizePlacePricing({
    category: place.category,
    price_level: place.price_level ?? null,
    price_min: place.price_min ?? null,
    price_max: place.price_max ?? null,
  });

  pricing.issues.forEach((code) => issues.push({
    code: code as PlaceDataIssue["code"],
    field: code.replace("invalid_", ""),
    detail: `raw=${String(code === "invalid_price_tier" ? place.price_level : code === "invalid_price_min" ? place.price_min : place.price_max)}`,
  }));

  (place.menu_items ?? []).forEach((item: Partial<PlaceMenuItem>, index) => {
    if (item.price !== null && item.price !== undefined && normalizeMenuPrice(item.price) === null) {
      issues.push({ code: "invalid_menu_price", field: `menu_items[${index}].price`, detail: `${item.name_ko ?? item.name_zh ?? "menu"}: ${String(item.price)}` });
    }
  });

  if (!place.china_info && [place.card_payment, place.solo_friendly, place.chinese_menu, place.luggage_friendly].some((value) => value === false)) {
    issues.push({ code: "legacy_boolean_without_tristate", field: "china_info", detail: "false legacy booleans cannot distinguish no from unknown" });
  }
  if (!hasChineseTranslation(place.name_zh, place.name_ko)) {
    issues.push({ code: "missing_chinese_name", field: "name_zh", detail: String(place.name_zh ?? "") });
  }
  if (place.address_zh && !isUsableChineseAddress(place.address_zh)) {
    issues.push({ code: "romanized_chinese_address", field: "address_zh", detail: place.address_zh });
  }

  const chineseCopy = [
    ["short_description_zh", place.short_description_zh],
    ["tips_zh", place.tips_zh],
    ["waiting_info_zh", place.waiting_info_zh],
    ["recommended_order_zh", place.recommended_order_zh],
  ] as const;
  chineseCopy.forEach(([field, value]) => {
    if (value && /[가-힣]/u.test(value)) issues.push({ code: "mixed_korean_in_chinese_copy", field, detail: value });
  });
  (place.menu_items ?? []).forEach((item: Partial<PlaceMenuItem>, index) => {
    if (item.name_zh && /[가-힣]/u.test(item.name_zh)) issues.push({ code: "mixed_korean_in_chinese_copy", field: `menu_items[${index}].name_zh`, detail: item.name_zh });
    if (item.description_zh && /[가-힣]/u.test(item.description_zh)) issues.push({ code: "mixed_korean_in_chinese_copy", field: `menu_items[${index}].description_zh`, detail: item.description_zh });
  });

  return issues;
}

function finiteInteger(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) value = Number(value.trim());
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) ? value : null;
}
