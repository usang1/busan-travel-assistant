import type { Locale } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

export type DifficultyState = "easy" | "moderate" | "hard" | "unknown";

export function getTasteProfile(place: PlaceWithRelations, locale: Locale) {
  const info = place.china_info;
  return [
    { key: "spicy", label: tasteLabels.spicy[locale], value: levelLabel("spicy", info?.spicy_level, locale) },
    { key: "oily", label: tasteLabels.oily[locale], value: levelLabel("oily", info?.greasy_level, locale) },
    { key: "aroma", label: tasteLabels.aroma[locale], value: levelLabel("aroma", info?.smell_level, locale) },
    { key: "sweet", label: tasteLabels.sweet[locale], value: levelLabel("sweet", info?.sweetness_level, locale) },
    { key: "portion", label: tasteLabels.portion[locale], value: levelLabel("portion", info?.portion_level, locale) },
    { key: "order", label: tasteLabels.order[locale], value: difficultyLabel(info?.ordering_difficulty, locale) },
  ];
}

export function hasTasteData(place: PlaceWithRelations) {
  const info = place.china_info;
  return [info?.spicy_level, info?.greasy_level, info?.smell_level, info?.sweetness_level, info?.portion_level, info?.ordering_difficulty].some((value) => typeof value === "number");
}

export function getForeignerDifficultyDimensions(place: PlaceWithRelations, locale: Locale) {
  const info = place.china_info;
  const insights = info?.traveler_insights;
  const kioskLanguages = info?.kiosk_language_support?.languages ?? [];
  const language = info?.chinese_menu === "yes" || insights?.english_menu === "yes" || kioskLanguages.some((item) => item.toLowerCase() !== "ko")
    ? "easy"
    : info?.chinese_menu === "no" && insights?.english_menu === "no" && info?.kiosk_language_support?.status === "no"
      ? "hard"
      : "unknown";
  const entry = info?.reservation_required === "yes" || info?.waiting_level === "long" || info?.waiting_level === "extreme"
    ? "hard"
    : info?.queue_available === "yes" || info?.waiting_level === "none" || info?.waiting_level === "short"
      ? "easy"
      : "unknown";
  const payment = info?.foreign_card === "yes" ? "easy" : info?.foreign_card === "no" ? "hard" : "unknown";
  const solo = numericDifficulty(place.decision_profile?.solo_difficulty) ?? (info?.solo_friendly === "yes" ? "easy" : info?.solo_friendly === "no" ? "hard" : "unknown");
  const order = numericDifficulty(info?.ordering_difficulty) ?? "unknown";

  return [
    { key: "wayfinding", label: dimensionLabels.wayfinding[locale], state: "unknown" as DifficultyState },
    { key: "entry", label: dimensionLabels.entry[locale], state: entry as DifficultyState },
    { key: "order", label: dimensionLabels.order[locale], state: order },
    { key: "payment", label: dimensionLabels.payment[locale], state: payment as DifficultyState },
    { key: "solo", label: dimensionLabels.solo[locale], state: solo },
    { key: "language", label: dimensionLabels.language[locale], state: language as DifficultyState },
  ].map((item) => ({ ...item, value: difficultyStateLabels[item.state][locale] }));
}

export function getLargestKnownObstacle(place: PlaceWithRelations, locale: Locale) {
  const dimensions = getForeignerDifficultyDimensions(place, locale);
  return dimensions.find((item) => item.state === "hard") ?? dimensions.find((item) => item.state === "moderate") ?? null;
}

function numericDifficulty(value: number | null | undefined): DifficultyState | null {
  if (typeof value !== "number") return null;
  if (value <= 2) return "easy";
  if (value === 3) return "moderate";
  return "hard";
}

function difficultyLabel(value: number | null | undefined, locale: Locale) {
  return difficultyStateLabels[numericDifficulty(value) ?? "unknown"][locale];
}

function levelLabel(kind: "spicy" | "oily" | "aroma" | "sweet" | "portion", value: number | null | undefined, locale: Locale) {
  if (typeof value !== "number") return unknown[locale];
  const bucket = value <= 1 ? 0 : value <= 2 ? 1 : value <= 3 ? 2 : 3;
  return levelLabels[kind][bucket][locale];
}

const unknown: Record<Locale, string> = { ko: "확인 중", zh: "确认中", en: "Checking", ja: "確認中" };
const tasteLabels = {
  spicy: { ko: "매운맛", zh: "辣度", en: "Spice", ja: "辛さ" }, oily: { ko: "느끼함", zh: "油腻度", en: "Oiliness", ja: "脂っこさ" },
  aroma: { ko: "향", zh: "香味", en: "Aroma", ja: "香り" }, sweet: { ko: "단맛", zh: "甜度", en: "Sweetness", ja: "甘さ" },
  portion: { ko: "양", zh: "份量", en: "Portion", ja: "量" }, order: { ko: "주문 난이도", zh: "点餐难度", en: "Ordering", ja: "注文難易度" },
} satisfies Record<string, Record<Locale, string>>;
const dimensionLabels = {
  wayfinding: { ko: "찾아가기", zh: "找到地点", en: "Wayfinding", ja: "アクセス" }, entry: { ko: "입장·웨이팅", zh: "入店与等位", en: "Entry and queue", ja: "入店・待ち" },
  order: { ko: "주문", zh: "点餐", en: "Ordering", ja: "注文" }, payment: { ko: "결제", zh: "支付", en: "Payment", ja: "支払い" },
  solo: { ko: "혼자 방문", zh: "一个人", en: "Solo visit", ja: "一人利用" }, language: { ko: "언어 소통", zh: "语言沟通", en: "Language", ja: "言語対応" },
} satisfies Record<string, Record<Locale, string>>;
export const difficultyStateLabels: Record<DifficultyState, Record<Locale, string>> = {
  easy: { ko: "쉬움", zh: "容易", en: "Easy", ja: "簡単" }, moderate: { ko: "보통", zh: "一般", en: "Moderate", ja: "普通" },
  hard: { ko: "어려움", zh: "较难", en: "Hard", ja: "難しい" }, unknown,
};
const levelLabels = {
  spicy: [
    { ko: "안 매움", zh: "不辣", en: "Not spicy", ja: "辛くない" }, { ko: "약간 매움", zh: "微辣", en: "Mild", ja: "少し辛い" },
    { ko: "중간 매움", zh: "中辣", en: "Medium", ja: "中辛" }, { ko: "많이 매움", zh: "很辣", en: "Very spicy", ja: "とても辛い" },
  ],
  oily: [
    { ko: "담백함", zh: "不油腻", en: "Not oily", ja: "あっさり" }, { ko: "약간 기름짐", zh: "稍油", en: "Slightly oily", ja: "やや脂あり" },
    { ko: "기름진 편", zh: "偏油", en: "Oily", ja: "脂多め" }, { ko: "매우 기름짐", zh: "很油", en: "Very oily", ja: "かなり脂多め" },
  ],
  aroma: [
    { ko: "향이 순함", zh: "香味温和", en: "Mild aroma", ja: "香り穏やか" }, { ko: "향이 약간 남", zh: "略有香味", en: "Light aroma", ja: "香りややあり" },
    { ko: "향이 뚜렷함", zh: "香料明显", en: "Distinct aroma", ja: "香りが明確" }, { ko: "향이 강함", zh: "香味很强", en: "Strong aroma", ja: "香りが強い" },
  ],
  sweet: [
    { ko: "달지 않음", zh: "不甜", en: "Not sweet", ja: "甘くない" }, { ko: "약간 달음", zh: "微甜", en: "Slightly sweet", ja: "少し甘い" },
    { ko: "단 편", zh: "偏甜", en: "Sweet", ja: "甘め" }, { ko: "매우 달음", zh: "很甜", en: "Very sweet", ja: "とても甘い" },
  ],
  portion: [
    { ko: "양 적음", zh: "份量偏少", en: "Small portion", ja: "少なめ" }, { ko: "보통보다 약간 적음", zh: "略少", en: "Slightly small", ja: "やや少なめ" },
    { ko: "보통", zh: "一般", en: "Average", ja: "普通" }, { ko: "양 많음", zh: "很多", en: "Large portion", ja: "多め" },
  ],
} satisfies Record<string, Array<Record<Locale, string>>>;
