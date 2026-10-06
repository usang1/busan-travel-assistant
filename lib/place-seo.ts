import { normalizePlacePricing, resolvePlaceFact } from "@/lib/place-data-integrity";
import type { Locale } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

const categoryCopy = {
  restaurant: { zh: "餐厅", en: "restaurant", ja: "飲食店", ko: "음식점" },
  cafe: { zh: "咖啡店", en: "cafe", ja: "カフェ", ko: "카페" },
  bar: { zh: "酒吧", en: "bar", ja: "バー", ko: "술집" },
  attraction: { zh: "景点", en: "attraction", ja: "観光スポット", ko: "관광지" },
  shopping: { zh: "购物地点", en: "shop", ja: "ショッピング", ko: "쇼핑" },
  photo_spot: { zh: "拍照地点", en: "photo spot", ja: "撮影スポット", ko: "사진 명소" },
  luggage: { zh: "行李寄存点", en: "luggage storage", ja: "荷物預かり", ko: "짐 보관" },
} as const;

export function buildTrustedPlaceMetaDescription(place: PlaceWithRelations, locale: Locale, verified: boolean) {
  const name = localizedName(place, locale);
  const korean = place.name_ko.trim();
  const title = locale === "zh" && name !== korean ? `${name}（韩文原名：${korean}）` : name;
  const parts = [title, categoryCopy[place.category][locale]];

  if (verified) {
    const pricing = normalizePlacePricing(place);
    const price = formatPricing(pricing.priceMin, pricing.priceMax, locale);
    if (price) parts.push(price);

    const card = resolvePlaceFact(place, "card_payment");
    if (card !== "unknown") parts.push(card === "yes" ? yesCard[locale] : noCard[locale]);
    const solo = resolvePlaceFact(place, "solo_friendly");
    if (solo !== "unknown") parts.push(solo === "yes" ? yesSolo[locale] : noSolo[locale]);
  }

  parts.push(changeNotice[locale]);
  return parts.filter(Boolean).join(locale === "zh" || locale === "ja" ? "，" : " · ").slice(0, 180);
}

function localizedName(place: PlaceWithRelations, locale: Locale) {
  const translation = place.translations?.find((item) => item.locale === locale)?.name?.trim();
  if (translation) return translation;
  if (locale === "zh" && place.name_zh.trim()) return place.name_zh.trim();
  return place.name_ko.trim();
}

function formatPricing(min: number | null, max: number | null, locale: Locale) {
  if (min === null && max === null) return "";
  if (min === 0 && max === 0) return { zh: "免费", en: "free", ja: "無料", ko: "무료" }[locale];
  const values = [min, max].filter((value): value is number => value !== null);
  if (values.length === 2 && values[0] === values[1]) return `₩${values[0].toLocaleString("ko-KR")}`;
  const range = values.map((value) => `₩${value.toLocaleString("ko-KR")}`).join(values.length === 2 && values[0] !== values[1] ? "–" : "");
  return range;
}

const yesCard = { zh: "已确认可刷卡", en: "card payment confirmed", ja: "カード利用確認済み", ko: "카드 결제 확인" } as const;
const noCard = { zh: "已确认不支持海外卡", en: "foreign cards not accepted", ja: "海外カード不可を確認", ko: "해외카드 불가 확인" } as const;
const yesSolo = { zh: "适合一人到访", en: "solo-friendly", ja: "一人利用可", ko: "혼자 방문 가능" } as const;
const noSolo = { zh: "不太适合一人到访", en: "not ideal for solo visits", ja: "一人利用には不向き", ko: "혼자 방문 어려움" } as const;
const changeNotice = { zh: "信息可能变化，请在到访前复核", en: "Details may change; recheck before visiting", ja: "情報は変更されるため訪問前に再確認してください", ko: "정보는 변경될 수 있어 방문 전 재확인이 필요합니다" } as const;
