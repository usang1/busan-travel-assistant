import { getOpeningStatus } from "@/lib/location";
import { buildChinaPlaceSummary } from "@/lib/place-china/format";
import type { Locale } from "@/lib/i18n";
import type { ChinaWaitingLevel, PlaceWithRelations } from "@/types/database";

export type ChinaDiscoveryFilter =
  | "chineseMenu"
  | "foreignCard"
  | "alipay"
  | "wechatPay"
  | "solo"
  | "luggage"
  | "lowWait"
  | "nonSpicy"
  | "subwayWalk5"
  | "xiaohongshu"
  | "openNight"
  | "firstBusan";

export type ChinaDiscoverySort = "chinaRecommended" | "saved" | "distance" | "lowWait";

export type ChinaPriceBucket = "all" | "low" | "mid" | "high";

export type ChinaDiscoveryFilterOption = {
  key: ChinaDiscoveryFilter;
  queryKey: string;
  label: Record<Locale, string>;
  compactLabel: Record<Locale, string>;
  match: (place: PlaceWithRelations) => boolean;
  enabled: (places: PlaceWithRelations[]) => boolean;
};

export const chinaDiscoveryFilters: ChinaDiscoveryFilterOption[] = [
  {
    key: "chineseMenu",
    queryKey: "chineseMenu",
    label: { zh: "中文菜单", en: "Chinese menu", ja: "中国語メニュー", ko: "중국어 메뉴" },
    compactLabel: { zh: "中文菜单", en: "Menu CN", ja: "中国語", ko: "중국어" },
    match: (place) => triStateOrLegacy(place, "chinese_menu", place.chinese_menu),
    enabled: (places) => places.some((place) => place.china_info?.chinese_menu === "yes" || place.chinese_menu),
  },
  {
    key: "foreignCard",
    queryKey: "foreignCard",
    label: { zh: "海外信用卡", en: "Foreign card", ja: "海外カード", ko: "해외카드" },
    compactLabel: { zh: "海外信用卡", en: "Card", ja: "カード", ko: "카드" },
    match: (place) => triStateOrLegacy(place, "foreign_card", place.card_payment),
    enabled: (places) => places.some((place) => place.china_info?.foreign_card === "yes" || place.card_payment),
  },
  {
    key: "alipay",
    queryKey: "alipay",
    label: { zh: "支付宝", en: "Alipay", ja: "Alipay", ko: "알리페이" },
    compactLabel: { zh: "支付宝", en: "Alipay", ja: "Alipay", ko: "알리페이" },
    match: (place) => place.china_info?.alipay === "yes",
    enabled: (places) => places.some((place) => place.china_info?.alipay === "yes"),
  },
  {
    key: "wechatPay",
    queryKey: "wechatPay",
    label: { zh: "微信支付", en: "WeChat Pay", ja: "WeChat Pay", ko: "위챗페이" },
    compactLabel: { zh: "微信支付", en: "WeChat", ja: "WeChat", ko: "위챗" },
    match: (place) => place.china_info?.wechat_pay === "yes",
    enabled: (places) => places.some((place) => place.china_info?.wechat_pay === "yes"),
  },
  {
    key: "solo",
    queryKey: "solo",
    label: { zh: "一个人OK", en: "Solo OK", ja: "一人OK", ko: "혼자 OK" },
    compactLabel: { zh: "一个人OK", en: "Solo", ja: "一人", ko: "혼자" },
    match: (place) => triStateOrLegacy(place, "solo_friendly", place.solo_friendly),
    enabled: (places) => places.some((place) => place.china_info?.solo_friendly === "yes" || place.solo_friendly),
  },
  {
    key: "luggage",
    queryKey: "luggage",
    label: { zh: "行李箱OK", en: "Luggage OK", ja: "荷物OK", ko: "캐리어 OK" },
    compactLabel: { zh: "行李箱OK", en: "Luggage", ja: "荷物", ko: "캐리어" },
    match: (place) => triStateOrLegacy(place, "luggage_friendly", place.luggage_friendly),
    enabled: (places) => places.some((place) => place.china_info?.luggage_friendly === "yes" || place.luggage_friendly),
  },
  {
    key: "lowWait",
    queryKey: "lowWait",
    label: { zh: "少排队", en: "Short wait", ja: "待ち少なめ", ko: "대기 적음" },
    compactLabel: { zh: "少排队", en: "Low wait", ja: "少待ち", ko: "대기적음" },
    match: (place) => place.china_info?.waiting_level === "none" || place.china_info?.waiting_level === "short",
    enabled: (places) => places.some((place) => place.china_info?.waiting_level === "none" || place.china_info?.waiting_level === "short"),
  },
  {
    key: "nonSpicy",
    queryKey: "nonSpicy",
    label: { zh: "不辣", en: "Not spicy", ja: "辛くない", ko: "안 매움" },
    compactLabel: { zh: "不辣", en: "Mild", ja: "辛くない", ko: "안매움" },
    match: (place) => typeof place.china_info?.spicy_level === "number" && place.china_info.spicy_level <= 2,
    enabled: (places) => places.some((place) => typeof place.china_info?.spicy_level === "number" && place.china_info.spicy_level <= 2),
  },
  {
    key: "subwayWalk5",
    queryKey: "subwayWalk5",
    label: { zh: "地铁步行5分钟以内", en: "Within 5 min from subway", ja: "駅徒歩5分以内", ko: "역 도보 5분 이내" },
    compactLabel: { zh: "地铁5分钟", en: "5 min subway", ja: "駅5分", ko: "역5분" },
    match: (place) => (place.china_info?.subway_walk_minutes ?? place.walking_minutes) <= 5,
    enabled: (places) => places.some((place) => (place.china_info?.subway_walk_minutes ?? place.walking_minutes) <= 5),
  },
  {
    key: "xiaohongshu",
    queryKey: "xiaohongshu",
    label: { zh: "小红书热门", en: "Xiaohongshu popular", ja: "小紅書人気", ko: "샤오홍슈 인기" },
    compactLabel: { zh: "小红书热门", en: "XHS", ja: "小紅書", ko: "샤오홍슈" },
    match: (place) => place.china_info?.xiaohongshu_popular === "yes",
    enabled: (places) => places.some((place) => place.china_info?.xiaohongshu_popular === "yes"),
  },
  {
    key: "openNight",
    queryKey: "openNight",
    label: { zh: "晚上营业", en: "Open at night", ja: "夜営業", ko: "밤 영업" },
    compactLabel: { zh: "晚上营业", en: "Night", ja: "夜", ko: "밤영업" },
    match: (place) => isOpenAtNight(place.opening_hours),
    enabled: (places) => places.some((place) => isOpenAtNight(place.opening_hours)),
  },
  {
    key: "firstBusan",
    queryKey: "firstBusan",
    label: { zh: "第一次来釜山", en: "First Busan trip", ja: "初めての釜山", ko: "부산 처음" },
    compactLabel: { zh: "第一次来釜山", en: "First trip", ja: "初釜山", ko: "부산처음" },
    match: (place) =>
      (place.china_info?.chinese_taste_score ?? 0) >= 4 ||
      place.china_info?.tourism_recommended === "yes" ||
      place.is_featured,
    enabled: (places) =>
      places.some(
        (place) =>
          (place.china_info?.chinese_taste_score ?? 0) >= 4 ||
          place.china_info?.tourism_recommended === "yes" ||
          place.is_featured,
      ),
  },
];

export const chinaQuickFilters: ChinaDiscoveryFilter[] = [
  "firstBusan",
  "solo",
  "luggage",
  "nonSpicy",
  "lowWait",
  "xiaohongshu",
  "openNight",
];

export const chinaPriceBuckets: Array<{
  value: ChinaPriceBucket;
  label: Record<Locale, string>;
  match: (place: PlaceWithRelations) => boolean;
}> = [
  { value: "all", label: { zh: "全部价格", en: "Any price", ja: "すべて", ko: "전체 가격" }, match: () => true },
  {
    value: "low",
    label: { zh: "低价 · ₩10,000以内", en: "Low · under ₩10,000", ja: "低価格 · ₩10,000以下", ko: "저가 · 1만원 이하" },
    match: (place) => maxKnownPrice(place) !== null && (maxKnownPrice(place) ?? 0) <= 10000,
  },
  {
    value: "mid",
    label: { zh: "中等 · ₩20,000以内", en: "Mid · under ₩20,000", ja: "中価格 · ₩20,000以下", ko: "중간 · 2만원 이하" },
    match: (place) => maxKnownPrice(place) !== null && (maxKnownPrice(place) ?? 0) > 10000 && (maxKnownPrice(place) ?? 0) <= 20000,
  },
  {
    value: "high",
    label: { zh: "高价 · ₩20,000以上", en: "High · ₩20,000+", ja: "高価格 · ₩20,000以上", ko: "고가 · 2만원 이상" },
    match: (place) => maxKnownPrice(place) !== null && (maxKnownPrice(place) ?? 0) > 20000,
  },
];

export function filterPlacesForChineseTraveler(
  places: PlaceWithRelations[],
  filters: ChinaDiscoveryFilter[],
  priceBucket: ChinaPriceBucket = "all",
) {
  const activeFilters = chinaDiscoveryFilters.filter((filter) => filters.includes(filter.key));
  const price = chinaPriceBuckets.find((bucket) => bucket.value === priceBucket) ?? chinaPriceBuckets[0];

  return places.filter((place) => activeFilters.every((filter) => filter.match(place)) && price.match(place));
}

export function sortPlacesForChineseTraveler<T extends { place: PlaceWithRelations; distance?: number | null }>(
  items: T[],
  sort: ChinaDiscoverySort,
) {
  return [...items].sort((a, b) => {
    if (sort === "saved") {
      return (b.place.save_count ?? 0) - (a.place.save_count ?? 0);
    }

    if (sort === "distance") {
      return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER);
    }

    if (sort === "lowWait") {
      const waitDiff = waitingRank(a.place.china_info?.waiting_level) - waitingRank(b.place.china_info?.waiting_level);

      if (waitDiff !== 0) {
        return waitDiff;
      }
    }

    const scoreDiff = (b.place.china_info?.chinese_taste_score ?? 0) - (a.place.china_info?.chinese_taste_score ?? 0);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    if (a.place.is_featured !== b.place.is_featured) {
      return a.place.is_featured ? -1 : 1;
    }

    return (b.place.save_count ?? 0) - (a.place.save_count ?? 0);
  });
}

export function getEnabledChinaFilters(places: PlaceWithRelations[]) {
  return chinaDiscoveryFilters.filter((filter) => filter.enabled(places));
}

export function getChinaFilterByQueryKey(queryKey: string) {
  return chinaDiscoveryFilters.find((filter) => filter.queryKey === queryKey);
}

export function getChinaDiscoveryTags(place: PlaceWithRelations, locale: Locale, limit = 4) {
  const info = place.china_info;
  const summary = buildChinaPlaceSummary(info);
  const tags: string[] = [];

  if (locale !== "zh") {
    return summary.tags.slice(0, limit);
  }

  if (typeof info?.spicy_level === "number" && info.spicy_level <= 2) tags.push("不辣");
  if (info?.foreign_card === "yes" || (!info && place.card_payment)) tags.push("海外信用卡");
  if (info?.solo_friendly === "yes" || (!info && place.solo_friendly)) tags.push("一个人OK");
  if (info?.luggage_friendly === "yes" || (!info && place.luggage_friendly)) tags.push("行李箱OK");
  if (info?.xiaohongshu_popular === "yes") tags.push("小红书热门");
  if (info?.chinese_menu === "yes" || (!info && place.chinese_menu)) tags.push("中文菜单");

  return Array.from(new Set([...tags, ...summary.tags])).slice(0, limit);
}

export function getChinaRecommendationLabel(place: PlaceWithRelations) {
  const score = place.china_info?.chinese_taste_score;

  if (typeof score === "number" && score >= 1 && score <= 5) {
    return `${score}/5`;
  }

  return "暂未确认";
}

export function countActiveChinaFilters(filters: ChinaDiscoveryFilter[], priceBucket: ChinaPriceBucket) {
  return filters.length + (priceBucket === "all" ? 0 : 1);
}

function triStateOrLegacy(
  place: PlaceWithRelations,
  key: "chinese_menu" | "foreign_card" | "solo_friendly" | "luggage_friendly",
  legacyValue: boolean,
) {
  const value = place.china_info?.[key];

  if (value === "yes") {
    return true;
  }

  if (value === "no" || value === "unknown") {
    return false;
  }

  return legacyValue;
}

function waitingRank(value: ChinaWaitingLevel | null | undefined) {
  return {
    none: 0,
    short: 1,
    moderate: 2,
    varies: 3,
    unknown: 4,
    long: 5,
    extreme: 6,
  }[value ?? "unknown"];
}

function isOpenAtNight(openingHours: string) {
  const normalized = openingHours.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized.includes("24시간") || normalized.includes("24h")) {
    return true;
  }

  const match = normalized.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);

  if (!match) {
    return getOpeningStatus(openingHours) === "open";
  }

  const closeHour = Number(match[3]);
  const closeMinute = Number(match[4]);
  const closeMinutes = closeHour * 60 + closeMinute;

  return closeHour < Number(match[1]) || closeMinutes >= 21 * 60;
}

function maxKnownPrice(place: PlaceWithRelations) {
  if (place.price_max !== null) {
    return place.price_max;
  }

  return place.price_min;
}
