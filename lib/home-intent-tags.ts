import type { Locale } from "@/lib/i18n";

export type HomeIntentKey = "firstGwangalli" | "food" | "rainyDay" | "solo" | "lateNight" | "luggage";

type HomeIntentTagOption = {
  key: HomeIntentKey;
  slug: string;
  label_ko: string;
  label_zh: string;
  labels: Record<Locale, string>;
};

export const homeIntentTagOptions: HomeIntentTagOption[] = [
  {
    key: "firstGwangalli",
    slug: "home-intent-first-gwangalli",
    label_ko: "광안리 처음 가면?",
    label_zh: "第一次去广安里",
    labels: { ko: "광안리 처음 가면?", zh: "第一次去广安里怎么玩", en: "First time in Gwangalli", ja: "初めての広安里" },
  },
  {
    key: "food",
    slug: "home-intent-gwangalli-food",
    label_ko: "광안리 맛집",
    label_zh: "广安里美食",
    labels: { ko: "광안리 맛집", zh: "广安里好吃的店", en: "Gwangalli food", ja: "広安里グルメ" },
  },
  {
    key: "rainyDay",
    slug: "home-intent-rainy-day",
    label_ko: "부산 비 오는 날",
    label_zh: "釜山雨天",
    labels: { ko: "부산 비 오는 날", zh: "釜山下雨天去哪", en: "Rainy day in Busan", ja: "雨の日の釜山" },
  },
  {
    key: "solo",
    slug: "home-intent-solo-travel",
    label_ko: "부산 여자 혼자 여행",
    label_zh: "釜山女性独自旅行",
    labels: { ko: "부산 여자 혼자 여행", zh: "一个人去釜山安全吗", en: "Solo Busan travel", ja: "一人旅の釜山" },
  },
  {
    key: "lateNight",
    slug: "home-intent-after-10pm",
    label_ko: "밤 10시 이후 갈 곳",
    label_zh: "晚上10点以后",
    labels: { ko: "밤 10시 이후 갈 곳", zh: "晚上10点以后去哪", en: "After 10 PM", ja: "夜10時以降" },
  },
  {
    key: "luggage",
    slug: "home-intent-luggage-storage",
    label_ko: "부산 짐 보관",
    label_zh: "釜山行李寄存",
    labels: { ko: "부산 짐 보관", zh: "行李寄存在哪里", en: "Luggage storage", ja: "荷物預かり" },
  },
];

const optionByKey = new Map(homeIntentTagOptions.map((option) => [option.key, option]));
const optionBySlug = new Map(homeIntentTagOptions.map((option) => [option.slug, option]));

export function buildHomeIntentTags(keys: HomeIntentKey[]) {
  return keys.flatMap((key) => {
    const option = optionByKey.get(key);
    return option ? [{ label_zh: option.label_zh, label_ko: option.label_ko, slug: option.slug }] : [];
  });
}

export function getHomeIntentKeysFromTags(tags: Array<{ slug: string }> | null | undefined) {
  return Array.from(new Set((tags ?? []).flatMap((tag) => {
    const key = optionBySlug.get(tag.slug)?.key;
    return key ? [key] : [];
  })));
}

export function getHomeIntentKeyFromSlug(slug: string) {
  return optionBySlug.get(slug)?.key ?? null;
}

export function getHomeIntentLabel(key: HomeIntentKey, locale: Locale) {
  return optionByKey.get(key)?.labels[locale] ?? "";
}

export function isHomeIntentKey(value: string | null): value is HomeIntentKey {
  return Boolean(value && optionByKey.has(value as HomeIntentKey));
}

export function isHomeIntentTagSlug(slug: string) {
  return optionBySlug.has(slug);
}
