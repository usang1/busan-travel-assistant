import { estimateWalkingMinutes, getPlaceDistance, gwangalliCenter, hasCoordinates } from "@/lib/location";
import { getTimeAwarePlaceState, hasReviewedTimeData, hasTimeFilterData } from "@/lib/time-aware-place";
import { buildChinaPlaceSummary } from "@/lib/place-china/format";
import type { Locale } from "@/lib/i18n";
import type { ChinaWaitingLevel, PlaceWithRelations } from "@/types/database";

export type ChinaDiscoveryFilter =
  | "openNow"
  | "recommendedNow"
  | "canVisitNow"
  | "withinHour"
  | "morningRecommended"
  | "sunsetRecommended"
  | "nightRecommended"
  | "after22"
  | "lowWaitTime"
  | "mondayAvailable"
  | "chineseMenu"
  | "foreignCard"
  | "alipay"
  | "wechatPay"
  | "solo"
  | "luggage"
  | "luggageStorage"
  | "restroom"
  | "noMinimumOrder"
  | "easyKiosk"
  | "parents"
  | "lowStairs"
  | "photoTrip"
  | "mobilePay"
  | "lowWait"
  | "nonSpicy"
  | "subwayWalk5"
  | "subwayWalk10"
  | "oceanView"
  | "rainyDay"
  | "xiaohongshu"
  | "openNight"
  | "firstBusan";

export type ChinaDiscoverySort = "verified" | "recent" | "chinaRecommended" | "saved" | "distance" | "lowWait";

export type ChinaPriceBucket = "all" | "low" | "mid" | "high";

export type ChinaDiscoveryFilterOption = {
  key: ChinaDiscoveryFilter;
  queryKey: string;
  label: Record<Locale, string>;
  compactLabel: Record<Locale, string>;
  match: (place: PlaceWithRelations) => boolean;
  enabled: (places: PlaceWithRelations[]) => boolean;
};

export type ChinaDiscoveryTagKey = Extract<ChinaDiscoveryFilter, "oceanView">;

type ChinaDiscoveryTagOption = {
  key: ChinaDiscoveryTagKey;
  slug: string;
  label_ko: string;
  label_zh: string;
  labels: Record<Locale, string>;
};

const oceanViewKeywords = ["海景", "看海", "海边", "广安大桥", "ocean", "sea view", "beach", "바다", "오션", "광안대교", "海が見える"];

export const chinaDiscoveryTagOptions: ChinaDiscoveryTagOption[] = [
  {
    key: "oceanView",
    slug: "china-filter-ocean-view",
    label_ko: "바다 전망",
    label_zh: "海景",
    labels: { zh: "海景", en: "Ocean view", ja: "海が見える", ko: "바다 전망" },
  },
];

const discoveryTagByKey = new Map(chinaDiscoveryTagOptions.map((option) => [option.key, option]));
const discoveryTagBySlug = new Map(chinaDiscoveryTagOptions.map((option) => [option.slug, option]));

export const chinaDiscoveryFilters: ChinaDiscoveryFilterOption[] = [
  {
    key: "recommendedNow", queryKey: "recommendedNow",
    label: { ko: "지금 추천", zh: "现在推荐", en: "Recommended now", ja: "今おすすめ" }, compactLabel: { ko: "지금 추천", zh: "现在推荐", en: "Now", ja: "今おすすめ" },
    match: (place) => matchesTimeAwareFilter(place, "recommendedNow", defaultTravelMinutes(place)), enabled: (places) => places.some((place) => hasReviewedTimeData(place) && Boolean(place.operating_profile?.recommended_time_ranges.length)),
  },
  {
    key: "canVisitNow", queryKey: "canVisitNow",
    label: { ko: "지금 갈 수 있음", zh: "现在可以去", en: "Can go now", ja: "今行ける" }, compactLabel: { ko: "지금 가능", zh: "现在可去", en: "Go now", ja: "今行ける" },
    match: (place) => matchesTimeAwareFilter(place, "canVisitNow", defaultTravelMinutes(place)), enabled: (places) => places.some(hasReviewedTimeData),
  },
  {
    key: "withinHour", queryKey: "withinHour",
    label: { ko: "1시간 안에 갈 수 있음", zh: "1小时内可去", en: "Reachable within 1 hour", ja: "1時間以内に行ける" }, compactLabel: { ko: "1시간 내", zh: "1小时内", en: "Within 1h", ja: "1時間内" },
    match: (place) => matchesTimeAwareFilter(place, "withinHour", defaultTravelMinutes(place)), enabled: (places) => places.some(hasReviewedTimeData),
  },
  ...([
    ["morningRecommended", "morning", "오전 추천", "上午推荐", "Morning", "午前おすすめ"],
    ["sunsetRecommended", "sunset", "일몰 전 추천", "日落前推荐", "Before sunset", "日没前おすすめ"],
    ["nightRecommended", "night", "야간 추천", "夜间推荐", "Night", "夜おすすめ"],
    ["after22", "after22", "밤 10시 이후", "晚上10点后", "After 10 PM", "22時以降"],
    ["lowWaitTime", "lowWait", "대기 적은 시간", "少等位时段", "Low-wait times", "待ち時間少なめ"],
    ["mondayAvailable", "monday", "월요일 이용 가능", "周一可用", "Open Monday", "月曜利用可"],
  ] as const).map(([key, dataKey, ko, zh, en, ja]) => ({
    key, queryKey: key, label: { ko, zh, en, ja }, compactLabel: { ko, zh, en, ja },
    match: (place: PlaceWithRelations) => hasTimeFilterData(place, dataKey), enabled: (places: PlaceWithRelations[]) => places.some((place) => hasTimeFilterData(place, dataKey)),
  })),
  {
    key: "openNow",
    queryKey: "openNow",
    label: { zh: "现在营业", en: "Open now", ja: "現在営業中", ko: "지금 영업 중" },
    compactLabel: { zh: "营业中", en: "Open", ja: "営業中", ko: "영업중" },
    match: (place) => getTimeAwarePlaceState(place).openNow === true,
    enabled: (places) => places.some((place) => hasReviewedTimeData(place) && getTimeAwarePlaceState(place).openNow === true),
  },
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
    key: "luggageStorage", queryKey: "luggageStorage",
    label: { zh: "可寄存行李", en: "Luggage storage", ja: "荷物預かり", ko: "짐 보관" },
    compactLabel: { zh: "寄存行李", en: "Storage", ja: "荷物預かり", ko: "짐보관" },
    match: (place) => place.china_info?.traveler_insights?.luggage_storage === "yes",
    enabled: (places) => places.some((place) => place.china_info?.traveler_insights?.luggage_storage === "yes"),
  },
  {
    key: "restroom", queryKey: "restroom",
    label: { zh: "有店内厕所", en: "Restroom available", ja: "店内トイレ", ko: "화장실 있음" },
    compactLabel: { zh: "厕所", en: "Restroom", ja: "トイレ", ko: "화장실" },
    match: (place) => place.china_info?.toilet_available === "yes",
    enabled: (places) => places.some((place) => place.china_info?.toilet_available === "yes"),
  },
  {
    key: "noMinimumOrder", queryKey: "noMinimumOrder",
    label: { zh: "无最低点餐", en: "No minimum order", ja: "最低注文なし", ko: "최소 주문 없음" },
    compactLabel: { zh: "无低消", en: "No minimum", ja: "最低なし", ko: "최소주문 없음" },
    match: (place) => place.china_info?.minimum_order_policy === "none",
    enabled: (places) => places.some((place) => place.china_info?.minimum_order_policy === "none"),
  },
  {
    key: "easyKiosk", queryKey: "easyKiosk",
    label: { zh: "自助机支持外语", en: "Easy-language kiosk", ja: "多言語キオスク", ko: "키오스크 사용 쉬움" },
    compactLabel: { zh: "外语自助机", en: "Easy kiosk", ja: "多言語端末", ko: "쉬운 키오스크" },
    match: (place) => hasNonKoreanKiosk(place), enabled: (places) => places.some(hasNonKoreanKiosk),
  },
  {
    key: "parents", queryKey: "parents",
    label: { zh: "适合带父母", en: "Good with parents", ja: "両親と訪問", ko: "부모님과 방문" },
    compactLabel: { zh: "带父母", en: "Parents", ja: "両親と", ko: "부모님" },
    match: (place) => place.decision_profile?.recommended_for.includes("parents") ?? false,
    enabled: (places) => places.some((place) => place.decision_profile?.recommended_for.includes("parents")),
  },
  {
    key: "lowStairs", queryKey: "lowStairs",
    label: { zh: "少楼梯", en: "Few stairs", ja: "階段少なめ", ko: "계단 적음" },
    compactLabel: { zh: "少楼梯", en: "Few stairs", ja: "階段少", ko: "계단적음" },
    match: (place) => place.china_info?.elevator === "yes" || place.china_info?.wheelchair_access === "yes",
    enabled: (places) => places.some((place) => place.china_info?.elevator === "yes" || place.china_info?.wheelchair_access === "yes"),
  },
  {
    key: "photoTrip", queryKey: "photoTrip",
    label: { zh: "适合拍照", en: "Good for photos", ja: "写真向き", ko: "사진 촬영" },
    compactLabel: { zh: "拍照", en: "Photos", ja: "写真", ko: "사진" },
    match: (place) => place.decision_profile?.recommended_for.includes("photo_trip") === true || place.china_info?.photo_recommended === "yes",
    enabled: (places) => places.some((place) => place.decision_profile?.recommended_for.includes("photo_trip") === true || place.china_info?.photo_recommended === "yes"),
  },
  {
    key: "mobilePay", queryKey: "mobilePay",
    label: { zh: "支付宝或微信支付", en: "Alipay or WeChat Pay", ja: "Alipay・WeChat Pay", ko: "알리페이·위챗페이" },
    compactLabel: { zh: "移动支付", en: "Mobile pay", ja: "モバイル決済", ko: "중국 간편결제" },
    match: (place) => place.china_info?.alipay === "yes" || place.china_info?.wechat_pay === "yes",
    enabled: (places) => places.some((place) => place.china_info?.alipay === "yes" || place.china_info?.wechat_pay === "yes"),
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
    match: (place) => {
      const minutes = subwayWalkingMinutes(place);
      return minutes !== null && minutes <= 5;
    },
    enabled: (places) => places.some((place) => {
      const minutes = subwayWalkingMinutes(place);
      return minutes !== null && minutes <= 5;
    }),
  },
  {
    key: "subwayWalk10",
    queryKey: "subwayWalk10",
    label: { zh: "地铁步行10分钟以内", en: "Within 10 min from subway", ja: "駅徒歩10分以内", ko: "역 도보 10분 이내" },
    compactLabel: { zh: "地铁10分钟", en: "10 min subway", ja: "駅10分", ko: "역10분" },
    match: (place) => {
      const minutes = subwayWalkingMinutes(place);
      return minutes !== null && minutes <= 10;
    },
    enabled: (places) => places.some((place) => {
      const minutes = subwayWalkingMinutes(place);
      return minutes !== null && minutes <= 10;
    }),
  },
  {
    key: "oceanView",
    queryKey: "oceanView",
    label: { zh: "海景", en: "Ocean view", ja: "海が見える", ko: "바다 전망" },
    compactLabel: { zh: "海景", en: "Ocean", ja: "海", ko: "바다" },
    match: (place) => hasChinaDiscoveryTag(place, "oceanView") || placeTextIncludes(place, oceanViewKeywords),
    enabled: (places) => places.some((place) => hasChinaDiscoveryTag(place, "oceanView") || placeTextIncludes(place, oceanViewKeywords)),
  },
  {
    key: "rainyDay",
    queryKey: "rainyDay",
    label: { zh: "雨天也适合", en: "Rainy day", ja: "雨の日向き", ko: "비 오는 날" },
    compactLabel: { zh: "雨天", en: "Rain", ja: "雨の日", ko: "비오는날" },
    match: (place) => reviewedDecisionProfile(place) && place.decision_profile?.recommended_for.includes("rainy_day") === true,
    enabled: (places) => places.some((place) => reviewedDecisionProfile(place) && place.decision_profile?.recommended_for.includes("rainy_day") === true),
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
    match: (place) => hasTimeFilterData(place, "after22"),
    enabled: (places) => places.some((place) => hasTimeFilterData(place, "after22")),
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

export function buildChinaDiscoveryTags(keys: ChinaDiscoveryTagKey[]) {
  return keys.flatMap((key) => {
    const option = discoveryTagByKey.get(key);
    return option ? [{ label_zh: option.label_zh, label_ko: option.label_ko, slug: option.slug }] : [];
  });
}

export function getChinaDiscoveryKeysFromTags(tags: Array<{ slug: string }> | null | undefined) {
  return Array.from(new Set((tags ?? []).flatMap((tag) => {
    const key = discoveryTagBySlug.get(tag.slug)?.key;
    return key ? [key] : [];
  })));
}

export function isChinaDiscoveryTagSlug(slug: string) {
  return discoveryTagBySlug.has(slug);
}

function subwayWalkingMinutes(place: PlaceWithRelations) {
  if (typeof place.china_info?.subway_walk_minutes === "number" && place.china_info.subway_walk_minutes > 0) {
    return place.china_info.subway_walk_minutes;
  }

  if (hasCoordinates(place) && place.walking_minutes > 0) {
    return place.walking_minutes;
  }

  return null;
}

export const chinaQuickFilters: ChinaDiscoveryFilter[] = [
  "recommendedNow",
  "canVisitNow",
  "openNow",
  "lowWait",
  "solo",
  "luggage",
  "oceanView",
  "rainyDay",
  "subwayWalk10",
  "chineseMenu",
  "restroom",
  "luggageStorage",
];

export const timeAwareDiscoveryFilters: ChinaDiscoveryFilter[] = ["recommendedNow", "canVisitNow", "withinHour"];

export function matchesTimeAwareFilter(place: PlaceWithRelations, filter: ChinaDiscoveryFilter, travelMinutes: number | null) {
  const state = getTimeAwarePlaceState(place, { travelMinutes });
  if (filter === "recommendedNow") return state.recommendedAtArrival === true;
  if (filter === "canVisitNow") return state.openAtArrival === true;
  if (filter === "withinHour") return (travelMinutes ?? Number.MAX_SAFE_INTEGER) <= 60 && state.openAtArrival === true;
  return true;
}

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
    if (sort === "verified") {
      const statusDiff = verificationRank(a.place) - verificationRank(b.place);
      if (statusDiff !== 0) return statusDiff;
      return verifiedTime(b.place) - verifiedTime(a.place);
    }

    if (sort === "recent") return verifiedTime(b.place) - verifiedTime(a.place);
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

export function hasVerifiedRecommendationScores(places: PlaceWithRelations[]) {
  return places.some((place) => {
    const profile = place.decision_profile;
    return Boolean(profile && profile.evidence_count > 0 && typeof profile.tourist_fit_score === "number" && (profile.verification_status === "verified" || profile.verification_status === "partially_verified"));
  });
}

export function getChinaFilterByQueryKey(queryKey: string) {
  return chinaDiscoveryFilters.find((filter) => filter.queryKey === queryKey);
}

export function getChinaDiscoveryTags(place: PlaceWithRelations, locale: Locale, limit = 4) {
  const info = place.china_info;
  const summary = buildChinaPlaceSummary(info);
  const tags: string[] = [];

  if (locale !== "zh") {
    return [];
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

function maxKnownPrice(place: PlaceWithRelations) {
  if (place.price_max !== null) {
    return place.price_max;
  }

  return place.price_min;
}

function reviewedDecisionProfile(place: PlaceWithRelations) {
  return Boolean(place.decision_profile && ["verified", "partially_verified"].includes(place.decision_profile.verification_status));
}

function hasChinaDiscoveryTag(place: PlaceWithRelations, key: ChinaDiscoveryTagKey) {
  const slug = discoveryTagByKey.get(key)?.slug;
  return Boolean(slug && place.tags.some((tag) => tag.slug === slug));
}

function placeTextIncludes(place: PlaceWithRelations, keywords: string[]) {
  const haystack = [
    place.name_zh,
    place.name_ko,
    place.short_description_zh,
    place.short_description_ko,
    place.address,
    place.address_zh,
    place.address_ko,
    place.recommended_order_zh,
    place.recommended_order_ko,
    place.tips_zh,
    place.tips_ko,
    place.admin_summary,
    place.nearest_station,
    place.nearest_exit,
    ...place.tags.flatMap((tag) => [tag.slug, tag.label_zh, tag.label_ko]),
    ...(place.translations ?? []).flatMap((translation) => [
      translation.name,
      translation.description,
      translation.travel_tip,
      translation.address,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function hasNonKoreanKiosk(place: PlaceWithRelations) {
  const kiosk = place.china_info?.kiosk_language_support;
  return kiosk?.status === "yes" && kiosk.languages.some((language) => language.toLowerCase() !== "ko");
}

function defaultTravelMinutes(place: PlaceWithRelations) {
  return estimateWalkingMinutes(getPlaceDistance(place, gwangalliCenter));
}

function verificationRank(place: PlaceWithRelations) {
  const legacyStatus = place.china_info?.has_information_conflict
    ? "conflicting"
    : place.china_info?.verification_status === "verified"
      ? "verified"
      : place.china_info?.verification_status === "needs_review"
        ? "partially_verified"
        : "unverified";
  return { verified: 0, partially_verified: 1, stale: 2, conflicting: 3, unverified: 4, rejected: 5 }[place.decision_profile?.verification_status ?? legacyStatus];
}

function verifiedTime(place: PlaceWithRelations) {
  const value = place.decision_profile?.last_verified_at ?? place.china_info?.verified_at ?? place.last_verified_at;
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
}
