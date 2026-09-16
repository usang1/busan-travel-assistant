import { busanDistrictOptions, inferBusanDistrictKey } from "@/lib/busan-districts";

export type PlaceCity = "busan" | "seoul" | "jeju";
export const placeCities: Array<{ key: PlaceCity; label: string }> = [
  { key: "busan", label: "부산" },
  { key: "seoul", label: "서울" },
  { key: "jeju", label: "제주" },
];

function region(key: string, ko: string, zh: string, en: string, ja: string) {
  return { key, labels: { ko, zh, en, ja } };
}

export const seoulDistricts = [
  region("gangnam-gu", "강남구", "江南区", "Gangnam-gu", "江南区"),
  region("gangdong-gu", "강동구", "江东区", "Gangdong-gu", "江東区"),
  region("gangbuk-gu", "강북구", "江北区", "Gangbuk-gu", "江北区"),
  region("gangseo-gu", "강서구", "江西区", "Gangseo-gu", "江西区"),
  region("gwanak-gu", "관악구", "冠岳区", "Gwanak-gu", "冠岳区"),
  region("gwangjin-gu", "광진구", "广津区", "Gwangjin-gu", "広津区"),
  region("guro-gu", "구로구", "九老区", "Guro-gu", "九老区"),
  region("geumcheon-gu", "금천구", "衿川区", "Geumcheon-gu", "衿川区"),
  region("nowon-gu", "노원구", "芦原区", "Nowon-gu", "蘆原区"),
  region("dobong-gu", "도봉구", "道峰区", "Dobong-gu", "道峰区"),
  region("dongdaemun-gu", "동대문구", "东大门区", "Dongdaemun-gu", "東大門区"),
  region("dongjak-gu", "동작구", "铜雀区", "Dongjak-gu", "銅雀区"),
  region("mapo-gu", "마포구", "麻浦区", "Mapo-gu", "麻浦区"),
  region("seodaemun-gu", "서대문구", "西大门区", "Seodaemun-gu", "西大門区"),
  region("seocho-gu", "서초구", "瑞草区", "Seocho-gu", "瑞草区"),
  region("seongdong-gu", "성동구", "城东区", "Seongdong-gu", "城東区"),
  region("seongbuk-gu", "성북구", "城北区", "Seongbuk-gu", "城北区"),
  region("songpa-gu", "송파구", "松坡区", "Songpa-gu", "松坡区"),
  region("yangcheon-gu", "양천구", "阳川区", "Yangcheon-gu", "陽川区"),
  region("yeongdeungpo-gu", "영등포구", "永登浦区", "Yeongdeungpo-gu", "永登浦区"),
  region("yongsan-gu", "용산구", "龙山区", "Yongsan-gu", "龍山区"),
  region("eunpyeong-gu", "은평구", "恩平区", "Eunpyeong-gu", "恩平区"),
  region("jongno-gu", "종로구", "钟路区", "Jongno-gu", "鐘路区"),
  region("jung-gu", "중구", "中区", "Jung-gu", "中区"),
  region("jungnang-gu", "중랑구", "中浪区", "Jungnang-gu", "中浪区"),
];

export const jejuRegions = [
  { key: "jeju-si", labels: { ko: "제주시", zh: "济州市", en: "Jeju City", ja: "済州市" }, searchKo: "제주시" },
  { key: "seogwipo-si", labels: { ko: "서귀포시", zh: "西归浦市", en: "Seogwipo", ja: "西帰浦市" }, searchKo: "서귀포시" },
];

export function cityRegions(city: PlaceCity) {
  return city === "seoul" ? seoulDistricts : city === "jeju" ? jejuRegions : busanDistrictOptions;
}

export function inferPlaceCity(address: string | null | undefined): PlaceCity | "" {
  const text = address?.trim() ?? "";
  if (/서울/.test(text)) return "seoul";
  if (/제주|서귀포/.test(text)) return "jeju";
  if (/부산/.test(text) || inferBusanDistrictKey(text)) return "busan";
  return "";
}

export function inferCityRegion(city: PlaceCity, address: string | null | undefined) {
  if (inferPlaceCity(address) && inferPlaceCity(address) !== city) return "";
  const text = (address ?? "").replace(/\s+/g, "");
  return [...cityRegions(city)].sort((a, b) => b.labels.ko.length - a.labels.ko.length)
    .find((option) => text.includes(option.labels.ko))?.key ?? "";
}

export function isPlaceRegionTag(slug: string) {
  return placeCities.some(({ key }) => slug === `place-city-${key}` ||
    cityRegions(key).some((region) => slug === `${key}-district-${region.key}`));
}

export function getPlaceRegion(place: { address_ko?: string | null; address?: string | null; tags?: Array<{ slug: string }> }) {
  const tags = place.tags ?? [];
  const city = placeCities.find(({ key }) => tags.some((tag) => tag.slug === `place-city-${key}`))?.key
    ?? placeCities.find(({ key }) => cityRegions(key).some((region) => tags.some((tag) => tag.slug === `${key}-district-${region.key}`)))?.key
    ?? (inferPlaceCity(place.address_ko || place.address) || "busan");
  const region = cityRegions(city).find((region) => tags.some((tag) => tag.slug === `${city}-district-${region.key}`))?.key
    ?? inferCityRegion(city, place.address_ko || place.address);
  return { city, region_key: region };
}

export function buildPlaceRegionTags(city: PlaceCity, regionKey: string, address: string) {
  const option = cityRegions(city).find((region) => region.key === (regionKey || inferCityRegion(city, address)));
  const label = placeCities.find((item) => item.key === city)!.label;
  return [
    { slug: `place-city-${city}`, label_ko: label, label_zh: { busan: "釜山", seoul: "首尔", jeju: "济州" }[city] },
    ...(option ? [{ slug: `${city}-district-${option.key}`, label_ko: option.labels.ko, label_zh: option.labels.zh }] : []),
  ];
}

export function placeRegionLabel(city: PlaceCity, regionKey: string, address: string) {
  return cityRegions(city).find((region) => region.key === (regionKey || inferCityRegion(city, address)))?.labels.ko
    ?? placeCities.find((item) => item.key === city)!.label;
}
