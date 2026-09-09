import { getLocalizedMenuItem, type Locale } from "@/lib/i18n";
import { verificationDateLabel } from "@/lib/traveler-insights";
import type { PlaceCategory, PlaceSourceProvider, PlaceVerificationStatus, PlaceWithRelations } from "@/types/database";

export type PlacePhotoDisplay =
  | { kind: "image"; url: string }
  | { kind: "placeholder"; title: string; detail: string };

export type PlaceCardFactKey = "menu" | "price" | "hours" | "solo" | "waiting";

export type PlaceCardFact = {
  key: PlaceCardFactKey;
  label: string;
  value: string;
};

const copy = {
  zh: {
    photoTitle: "照片准备中",
    photoDetail: "没有使用临时旅游照片",
    noPublicDescription: "公开推荐说明准备中。",
    infoPreparing: "详细营业信息准备中",
    verified: "已确认",
    pending: "确认中",
    needsReview: "需复核",
    unverified: "未确认",
    sourceUnknown: "来源确认中",
    officialSite: "官方网站",
    lastCheckedMissing: "确认日准备中",
    labels: { menu: "招牌", price: "价格", hours: "营业", solo: "单人", waiting: "等位" },
  },
  en: {
    photoTitle: "Photo pending",
    photoDetail: "No temporary travel photo is shown",
    noPublicDescription: "Public recommendation copy is being prepared.",
    infoPreparing: "Business details are being prepared",
    verified: "Verified",
    pending: "Checking",
    needsReview: "Needs review",
    unverified: "Unverified",
    sourceUnknown: "Source pending",
    officialSite: "Official site",
    lastCheckedMissing: "Last checked pending",
    labels: { menu: "Menu", price: "Price", hours: "Hours", solo: "Solo", waiting: "Wait" },
  },
  ja: {
    photoTitle: "写真準備中",
    photoDetail: "仮の観光写真は表示していません",
    noPublicDescription: "公開用のおすすめ説明を準備中です。",
    infoPreparing: "詳しい営業情報を準備中",
    verified: "確認済み",
    pending: "確認中",
    needsReview: "再確認が必要",
    unverified: "未確認",
    sourceUnknown: "出典確認中",
    officialSite: "公式サイト",
    lastCheckedMissing: "確認日準備中",
    labels: { menu: "代表", price: "価格", hours: "営業時間", solo: "一人", waiting: "待ち" },
  },
  ko: {
    photoTitle: "사진 준비 중",
    photoDetail: "임시 관광 사진을 사용하지 않습니다",
    noPublicDescription: "공개 추천 설명을 준비 중입니다.",
    infoPreparing: "세부 영업정보 준비 중",
    verified: "검증됨",
    pending: "확인 중",
    needsReview: "재확인 필요",
    unverified: "미확인",
    sourceUnknown: "출처 확인 중",
    officialSite: "공식 링크",
    lastCheckedMissing: "확인일 준비 중",
    labels: { menu: "대표", price: "가격", hours: "영업", solo: "혼밥", waiting: "웨이팅" },
  },
} as const;

const genericImageHosts = ["images.unsplash.com", "plus.unsplash.com", "source.unsplash.com", "unsplash.com"];

const sourceLabels: Record<PlaceSourceProvider, Record<Locale, string>> = {
  NAVER: { zh: "Naver 地图", en: "Naver Map", ja: "Naver Map", ko: "네이버지도" },
  KAKAO: { zh: "Kakao 地图", en: "Kakao Map", ja: "Kakao Map", ko: "카카오맵" },
  GOOGLE: { zh: "Google Maps", en: "Google Maps", ja: "Google Maps", ko: "Google Maps" },
  MANUAL: { zh: "人工确认", en: "Manual review", ja: "手動確認", ko: "관리자 확인" },
};

export function getPlaceTrustCopy(locale: Locale) {
  return copy[locale];
}

export function getPlacePhotoDisplay(place: Pick<PlaceWithRelations, "thumbnail_url" | "category">, locale: Locale): PlacePhotoDisplay {
  const url = place.thumbnail_url?.trim() ?? "";

  if (url && !isGenericPlaceholderImageUrl(url)) {
    return { kind: "image", url };
  }

  return {
    kind: "placeholder",
    title: `${copy[locale].photoTitle} · ${categoryPlaceholderLabel(place.category, locale)}`,
    detail: copy[locale].photoDetail,
  };
}

export function getTrustedPlaceImageUrl(place: Pick<PlaceWithRelations, "thumbnail_url" | "category">) {
  const url = place.thumbnail_url?.trim() ?? "";
  return url && !isGenericPlaceholderImageUrl(url) ? url : "";
}

export function getPublicPlaceDescription(place: PlaceWithRelations, locale: Locale) {
  const exact = exactLocalizedText(place, "description", locale);
  return isUsablePublicDescription(exact) ? exact : "";
}

export function getPublicTravelTip(place: PlaceWithRelations, locale: Locale) {
  const exact = exactLocalizedText(place, "travel_tip", locale);
  return isUsablePublicDescription(exact) ? exact : "";
}

export function buildPlaceCardFacts(place: PlaceWithRelations, locale: Locale) {
  const labels = copy[locale].labels;
  const facts: PlaceCardFact[] = [];
  const missing: PlaceCardFactKey[] = [];
  const menu = getConfirmedRepresentativeMenu(place, locale);
  const price = getConfirmedPriceLabel(place, locale);
  const hours = place.opening_hours.trim();
  const solo = getConfirmedSoloLabel(place, locale);
  const waiting = getConfirmedWaitingLabel(place, locale);

  addFact(facts, missing, "menu", labels.menu, menu);
  addFact(facts, missing, "price", labels.price, price);
  addFact(facts, missing, "hours", labels.hours, hours);
  addFact(facts, missing, "solo", labels.solo, solo);
  addFact(facts, missing, "waiting", labels.waiting, waiting);

  return {
    facts,
    missing,
    missingSummary: missing.length >= 2 ? copy[locale].infoPreparing : "",
  };
}

export function getVerificationStatus(place: PlaceWithRelations): PlaceVerificationStatus {
  const status = place.china_info?.verification_status;
  if (status === "verified" || status === "pending" || status === "needs_review" || status === "unverified") {
    return status;
  }

  return getLastVerifiedAt(place) ? "verified" : "unverified";
}

export function getVerificationStatusLabel(status: PlaceVerificationStatus, locale: Locale) {
  if (status === "verified") return copy[locale].verified;
  if (status === "pending") return copy[locale].pending;
  if (status === "needs_review") return copy[locale].needsReview;
  return copy[locale].unverified;
}

export function getLastVerifiedAt(place: PlaceWithRelations) {
  return (
    normalizeDateString(place.last_verified_at) ||
    normalizeDateString(place.china_info?.verified_at) ||
    place.sources?.map((source) => normalizeDateString(source.last_synced_at)).find(Boolean) ||
    ""
  );
}

export function getLastVerifiedLabel(place: PlaceWithRelations, locale: Locale) {
  const date = getLastVerifiedAt(place);
  return verificationDateLabel(date, locale) || copy[locale].lastCheckedMissing;
}

export function getSourceSummary(place: PlaceWithRelations, locale: Locale) {
  const sourceLabelsForPlace = Array.from(
    new Set(
      (place.sources ?? [])
        .filter((source) => source.source_url?.trim() || source.external_id?.trim())
        .map((source) => sourceLabels[source.provider]?.[locale])
        .filter((label): label is string => Boolean(label)),
    ),
  );

  if (sourceLabelsForPlace.length > 0) {
    return sourceLabelsForPlace.slice(0, 2).join(" · ");
  }

  if (place.website?.trim()) {
    return copy[locale].officialSite;
  }

  return copy[locale].sourceUnknown;
}

function addFact(facts: PlaceCardFact[], missing: PlaceCardFactKey[], key: PlaceCardFactKey, label: string, value: string) {
  if (value) {
    facts.push({ key, label, value });
    return;
  }

  missing.push(key);
}

function getConfirmedRepresentativeMenu(place: PlaceWithRelations, locale: Locale) {
  const item = [...place.menu_items].sort((a, b) => Number(b.is_recommended) - Number(a.is_recommended) || a.sort_order - b.sort_order)[0];

  if (!item) {
    const fallback = exactLocalizedRecommendedOrder(place, locale);
    return isUsablePublicDescription(fallback) ? fallback : "";
  }

  const menu = getLocalizedMenuItem(item, locale);
  const name = menu.name.trim();
  if (!name) return "";

  return typeof item.price === "number" && item.price >= 0 ? `${name} · ${formatTrustWon(item.price, locale)}` : name;
}

function getConfirmedPriceLabel(place: PlaceWithRelations, locale: Locale) {
  if (typeof place.price_min === "number" && typeof place.price_max === "number") {
    if (place.price_min === 0 && place.price_max === 0) return formatTrustWon(0, locale);
    if (place.price_min !== place.price_max) return `${formatTrustWon(place.price_min, locale)}-${formatTrustWon(place.price_max, locale)}`;
    return formatTrustWon(place.price_min, locale);
  }

  if (typeof place.price_min === "number") return formatTrustWon(place.price_min, locale);
  if (typeof place.price_max === "number") return formatTrustWon(place.price_max, locale);
  if (typeof place.price_level === "number" && place.price_level >= 0) return place.price_level === 0 ? formatTrustWon(0, locale) : "₩".repeat(Math.min(place.price_level, 4));
  return "";
}

function formatTrustWon(value: number, locale: Locale) {
  if (value === 0) {
    return { zh: "免费", en: "Free", ja: "無料", ko: "무료" }[locale];
  }

  return `₩${value.toLocaleString("ko-KR")}`;
}

function getConfirmedSoloLabel(place: PlaceWithRelations, locale: Locale) {
  const value = place.china_info?.solo_friendly;

  if (value === "yes") return { zh: "一个人OK", en: "Solo OK", ja: "一人OK", ko: "혼밥 가능" }[locale];
  if (value === "no") return { zh: "不适合单人", en: "Not solo friendly", ja: "一人利用は難しい", ko: "혼밥 어려움" }[locale];
  if (!place.china_info && place.solo_friendly) return { zh: "一个人OK", en: "Solo OK", ja: "一人OK", ko: "혼밥 가능" }[locale];
  return "";
}

function getConfirmedWaitingLabel(place: PlaceWithRelations, locale: Locale) {
  const level = place.china_info?.waiting_level;

  if (level === "none") return { zh: "基本无需等位", en: "Little or no wait", ja: "待ち時間ほぼなし", ko: "웨이팅 거의 없음" }[locale];
  if (level === "short") return { zh: "约5-10分钟", en: "About 5-10 min", ja: "約5-10分", ko: "약 5~10분" }[locale];
  if (level === "moderate") return { zh: "约10-20分钟", en: "About 10-20 min", ja: "約10-20分", ko: "약 10~20분" }[locale];
  if (level === "long") return { zh: "约20-40分钟", en: "About 20-40 min", ja: "約20-40分", ko: "약 20~40분" }[locale];
  if (level === "extreme") return { zh: "40分钟以上", en: "Over 40 min", ja: "40分以上", ko: "40분 이상" }[locale];
  if (level === "varies") return { zh: "按时段变化", en: "Varies by time", ja: "時間帯で変動", ko: "시간대별 변동" }[locale];

  const exactWaiting = locale === "zh" ? place.waiting_info_zh.trim() : locale === "ko" ? place.waiting_info_ko.trim() : "";
  return isUsablePublicDescription(exactWaiting) ? exactWaiting : "";
}

function exactLocalizedText(place: PlaceWithRelations, field: "description" | "travel_tip", locale: Locale) {
  const translation = place.translations?.find((item) => item.locale === locale);
  const translatedValue = field === "description" ? translation?.description : translation?.travel_tip;
  if (translatedValue?.trim()) return translatedValue.trim();

  if (locale === "zh") return (field === "description" ? place.short_description_zh : place.tips_zh).trim();
  if (locale === "ko") return (field === "description" ? place.short_description_ko : place.tips_ko).trim();
  return "";
}

function exactLocalizedRecommendedOrder(place: PlaceWithRelations, locale: Locale) {
  if (locale === "zh") return place.recommended_order_zh.trim();
  if (locale === "ko") return place.recommended_order_ko.trim();
  return "";
}

function isUsablePublicDescription(value: string) {
  const text = value.trim();
  if (text.length < 14) return false;
  if (/^(존맛탱|맛집|똠양꿍\s*맛집|핫플|추천|괜찮음)[\s!.。]*$/i.test(text)) return false;
  return true;
}

function isGenericPlaceholderImageUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return genericImageHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function normalizeDateString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function categoryPlaceholderLabel(category: PlaceCategory, locale: Locale) {
  const labels: Record<PlaceCategory, Record<Locale, string>> = {
    restaurant: { zh: "餐厅", en: "Restaurant", ja: "飲食店", ko: "음식점" },
    cafe: { zh: "咖啡", en: "Cafe", ja: "カフェ", ko: "카페" },
    bar: { zh: "酒吧", en: "Bar", ja: "バー", ko: "술집" },
    attraction: { zh: "景点", en: "Attraction", ja: "観光", ko: "관광" },
    shopping: { zh: "购物", en: "Shopping", ja: "ショッピング", ko: "쇼핑" },
    photo_spot: { zh: "拍照", en: "Photo spot", ja: "写真スポット", ko: "사진 스팟" },
    luggage: { zh: "行李寄存", en: "Luggage", ja: "荷物預かり", ko: "짐 보관" },
  };

  return labels[category][locale];
}
