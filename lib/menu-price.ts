import type { Locale } from "@/lib/i18n";
import { normalizeMenuPrice } from "@/lib/place-data-integrity";
import type { PlaceMenuItem } from "@/types/database";

const variablePrice = {
  zh: "价格浮动 · 下单前确认",
  en: "Variable price · confirm before ordering",
  ja: "価格変動 · 注文前に確認",
  ko: "가격 변동 · 주문 전 확인",
} as const;

const unknownPrice = { zh: "价格确认中", en: "Price to be confirmed", ja: "価格確認中", ko: "가격 확인 중" } as const;
const freePrice = { zh: "免费", en: "Free", ja: "無料", ko: "무료" } as const;

export function getMenuPriceLabel(item: Pick<PlaceMenuItem, "price" | "price_is_variable">, locale: Locale) {
  if (item.price_is_variable === true) return variablePrice[locale];
  const price = normalizeMenuPrice(item.price);
  if (price === null) return unknownPrice[locale];
  return price === 0 ? freePrice[locale] : `₩${price.toLocaleString("ko-KR")}`;
}

export function getKnownMenuAmount(item: Pick<PlaceMenuItem, "price" | "price_is_variable">) {
  return item.price_is_variable === true ? null : normalizeMenuPrice(item.price);
}
