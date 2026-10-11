import type { Locale } from "@/lib/i18n";

export const priceLevelCodes = [0, 1, 2, 3, 4] as const;
export type PriceLevelCode = (typeof priceLevelCodes)[number];

const labels: Record<Locale, Record<PriceLevelCode, string>> = {
  ko: { 0: "무료", 1: "원화 1단계 (₩)", 2: "원화 2단계 (₩₩)", 3: "원화 3단계 (₩₩₩)", 4: "원화 4단계 (₩₩₩₩)" },
  zh: { 0: "免费", 1: "韩元 1级 (₩)", 2: "韩元 2级 (₩₩)", 3: "韩元 3级 (₩₩₩)", 4: "韩元 4级 (₩₩₩₩)" },
  en: { 0: "Free", 1: "KRW level 1 (₩)", 2: "KRW level 2 (₩₩)", 3: "KRW level 3 (₩₩₩)", 4: "KRW level 4 (₩₩₩₩)" },
  ja: { 0: "無料", 1: "韓国ウォン 1段階 (₩)", 2: "韓国ウォン 2段階 (₩₩)", 3: "韓国ウォン 3段階 (₩₩₩)", 4: "韓国ウォン 4段階 (₩₩₩₩)" },
};

export function getPriceLevelLabel(level: PriceLevelCode, locale: Locale = "ko") {
  return labels[locale][level];
}

