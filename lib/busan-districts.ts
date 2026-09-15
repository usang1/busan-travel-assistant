import type { Locale } from "@/lib/i18n";

export const busanDistrictKeys = [
  "jung-gu",
  "seo-gu",
  "dong-gu",
  "yeongdo-gu",
  "busanjin-gu",
  "dongnae-gu",
  "nam-gu",
  "buk-gu",
  "haeundae-gu",
  "saha-gu",
  "geumjeong-gu",
  "gangseo-gu",
  "yeonje-gu",
  "suyeong-gu",
  "sasang-gu",
  "gijang-gun",
] as const;

export type BusanDistrictKey = (typeof busanDistrictKeys)[number];

type BusanDistrictOption = {
  key: BusanDistrictKey;
  slug: string;
  labels: Record<Locale, string>;
};

export const busanDistrictOptions: BusanDistrictOption[] = [
  district("jung-gu", "중구", "中区", "Jung-gu", "中区"),
  district("seo-gu", "서구", "西区", "Seo-gu", "西区"),
  district("dong-gu", "동구", "东区", "Dong-gu", "東区"),
  district("yeongdo-gu", "영도구", "影岛区", "Yeongdo-gu", "影島区"),
  district("busanjin-gu", "부산진구", "釜山镇区", "Busanjin-gu", "釜山鎮区"),
  district("dongnae-gu", "동래구", "东莱区", "Dongnae-gu", "東莱区"),
  district("nam-gu", "남구", "南区", "Nam-gu", "南区"),
  district("buk-gu", "북구", "北区", "Buk-gu", "北区"),
  district("haeundae-gu", "해운대구", "海云台区", "Haeundae-gu", "海雲台区"),
  district("saha-gu", "사하구", "沙下区", "Saha-gu", "沙下区"),
  district("geumjeong-gu", "금정구", "金井区", "Geumjeong-gu", "金井区"),
  district("gangseo-gu", "강서구", "江西区", "Gangseo-gu", "江西区"),
  district("yeonje-gu", "연제구", "莲堤区", "Yeonje-gu", "蓮堤区"),
  district("suyeong-gu", "수영구", "水营区", "Suyeong-gu", "水営区"),
  district("sasang-gu", "사상구", "沙上区", "Sasang-gu", "沙上区"),
  district("gijang-gun", "기장군", "机张郡", "Gijang-gun", "機張郡"),
];

const optionByKey = new Map(busanDistrictOptions.map((option) => [option.key, option]));
const optionBySlug = new Map(busanDistrictOptions.map((option) => [option.slug, option]));
const optionsByLongestKoreanLabel = [...busanDistrictOptions].sort((a, b) => b.labels.ko.length - a.labels.ko.length);

function district(key: BusanDistrictKey, ko: string, zh: string, en: string, ja: string): BusanDistrictOption {
  return { key, slug: `busan-district-${key}`, labels: { ko, zh, en, ja } };
}

export function isBusanDistrictKey(value: string | null | undefined): value is BusanDistrictKey {
  return Boolean(value && optionByKey.has(value as BusanDistrictKey));
}

export function isBusanDistrictTagSlug(slug: string) {
  return optionBySlug.has(slug);
}

export function getBusanDistrictLabel(key: BusanDistrictKey, locale: Locale) {
  return optionByKey.get(key)?.labels[locale] ?? "";
}

export function buildBusanDistrictTags(key: BusanDistrictKey | "") {
  const option = key ? optionByKey.get(key) : null;
  return option ? [{ label_zh: option.labels.zh, label_ko: option.labels.ko, slug: option.slug }] : [];
}

export function inferBusanDistrictKey(address: string | null | undefined): BusanDistrictKey | null {
  const source = address?.normalize("NFKC").trim() ?? "";
  const normalized = source.replace(/\s+/g, "");
  if (!normalized) return null;

  for (const option of optionsByLongestKoreanLabel) {
    if (normalized.includes("부산") && normalized.includes(option.labels.ko)) return option.key;
    if (source.startsWith(option.labels.ko)) return option.key;
  }

  return null;
}

export function getBusanDistrictKey(place: {
  address?: string | null;
  address_ko?: string | null;
  tags?: Array<{ slug: string }> | null;
}): BusanDistrictKey | null {
  const tagged = (place.tags ?? []).find((tag) => optionBySlug.has(tag.slug));
  if (tagged) return optionBySlug.get(tagged.slug)?.key ?? null;
  return inferBusanDistrictKey(place.address_ko || place.address || "");
}
