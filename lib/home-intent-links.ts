import { getChinaFilterByQueryKey } from "@/lib/place-china/discovery";
import { getBusanDistrictKey, getBusanDistrictLabel, type BusanDistrictKey } from "@/lib/busan-districts";
import { isPublicPlace } from "@/lib/place-publishing";
import { type Locale, withLocale } from "@/lib/i18n";
import { getHomeIntentKeysFromTags, type HomeIntentKey } from "@/lib/home-intent-tags";
import type { PlaceWithRelations } from "@/types/database";
import type { Guide } from "@/types/guide";

export type { HomeIntentKey } from "@/lib/home-intent-tags";

type HomeIntentCopy = {
  key: HomeIntentKey;
  label: string;
  description: string;
  search: string;
  terms: string[];
};

export type HomeIntentDestination = "guide" | "places" | "pending";

export type ResolvedHomeIntentCard = HomeIntentCopy & {
  destination: HomeIntentDestination;
  href: string | null;
};

type ResolveHomeIntentCardsInput = {
  guides: Guide[];
  places: PlaceWithRelations[];
  locale: Locale;
  district?: BusanDistrictKey;
};

type PlaceTarget = {
  href: string;
  hasMatch: (places: PlaceWithRelations[]) => boolean;
};

type DistrictIntentCopy = Record<HomeIntentKey, {
  label: (district: string) => string;
  description: (district: string) => string;
}>;

export const homeIntentCards: Record<Locale, HomeIntentCopy[]> = {
  zh: [
    { key: "firstGwangalli", label: "第一次去广安里怎么玩", description: "查看适合第一次到访的已公开地点。", search: "广安里 第一次", terms: ["광안리", "처음", "첫", "广安里", "第一次"] },
    { key: "food", label: "广安里好吃的店", description: "查看公开的餐厅、美食与菜单信息。", search: "광안리 맛집", terms: ["광안리", "맛집", "음식", "广安里", "美食", "餐厅"] },
    { key: "rainyDay", label: "釜山下雨天去哪", description: "查看雨天也适合的公开地点。", search: "비 오는 날", terms: ["비", "雨", "실내", "室内", "rain"] },
    { key: "solo", label: "一个人去釜山安全吗", description: "查看适合独自用餐和移动的公开地点。", search: "여자 혼자 여행", terms: ["혼자", "女", "solo", "一个人", "一人"] },
    { key: "lateNight", label: "晚上10点以后去哪", description: "查看夜间仍可考虑的公开地点。", search: "밤 10시", terms: ["밤", "10", "夜", "late", "night"] },
    { key: "luggage", label: "行李寄存在哪里", description: "查看公开的行李寄存地点。", search: "짐 보관", terms: ["짐", "보관", "行李", "luggage", "荷物"] },
  ],
  en: [
    { key: "firstGwangalli", label: "First time in Gwangalli", description: "See published places that work for a first visit.", search: "Gwangalli first time", terms: ["gwangalli", "first", "광안리", "처음"] },
    { key: "food", label: "Gwangalli food", description: "See published restaurants, menus, and food picks.", search: "Gwangalli food", terms: ["food", "restaurant", "맛집", "음식", "美食"] },
    { key: "rainyDay", label: "Rainy day in Busan", description: "See published places that still work in the rain.", search: "rainy day", terms: ["rain", "rainy", "비", "雨", "indoor"] },
    { key: "solo", label: "Solo Busan travel", description: "See published places that work well alone.", search: "solo travel", terms: ["solo", "혼자", "一个人", "一人"] },
    { key: "lateNight", label: "After 10 PM", description: "See published places to consider late at night.", search: "after 10", terms: ["night", "10", "밤", "late"] },
    { key: "luggage", label: "Luggage storage", description: "See published luggage storage places.", search: "luggage", terms: ["luggage", "짐", "보관", "行李", "荷物"] },
  ],
  ja: [
    { key: "firstGwangalli", label: "初めての広安里", description: "初めての訪問に向く公開スポットを確認。", search: "広安里 初めて", terms: ["광안리", "広安里", "처음", "初めて"] },
    { key: "food", label: "広安里グルメ", description: "公開中の飲食店、メニュー、グルメ情報を確認。", search: "広安里 グルメ", terms: ["맛집", "음식", "グルメ", "food", "restaurant"] },
    { key: "rainyDay", label: "雨の日の釜山", description: "雨の日にも使いやすい公開スポットを確認。", search: "雨の日", terms: ["雨", "비", "indoor", "室内"] },
    { key: "solo", label: "一人旅の釜山", description: "一人でも使いやすい公開スポットを確認。", search: "一人旅", terms: ["一人", "혼자", "solo"] },
    { key: "lateNight", label: "夜10時以降", description: "夜に検討できる公開スポットを確認。", search: "夜10時", terms: ["夜", "10", "밤", "night"] },
    { key: "luggage", label: "荷物預かり", description: "公開中の荷物預かりスポットを確認。", search: "荷物", terms: ["荷物", "짐", "보관", "luggage"] },
  ],
  ko: [
    { key: "firstGwangalli", label: "광안리 처음 가면?", description: "첫 방문에 맞는 공개 장소를 확인하세요.", search: "광안리 처음", terms: ["광안리", "처음", "첫"] },
    { key: "food", label: "광안리 맛집", description: "공개된 음식점, 메뉴, 웨이팅 정보를 확인하세요.", search: "광안리 맛집", terms: ["광안리", "맛집", "음식", "식당"] },
    { key: "rainyDay", label: "부산 비 오는 날", description: "비 오는 날에도 가기 좋은 공개 장소를 확인하세요.", search: "비 오는 날", terms: ["비", "실내", "rain"] },
    { key: "solo", label: "부산 여자 혼자 여행", description: "혼자 이용하기 좋은 공개 장소를 확인하세요.", search: "여자 혼자 여행", terms: ["혼자", "여자", "solo"] },
    { key: "lateNight", label: "밤 10시 이후 갈 곳", description: "늦은 시간에도 고려할 수 있는 공개 장소를 확인하세요.", search: "밤 10시", terms: ["밤", "10", "야간", "night"] },
    { key: "luggage", label: "부산 짐 보관", description: "공개된 짐 보관 장소를 확인하세요.", search: "짐 보관", terms: ["짐", "보관", "luggage"] },
  ],
};

const districtIntentCopy: Record<Locale, DistrictIntentCopy> = {
  ko: {
    firstGwangalli: { label: (district) => `${district} 처음 가면?`, description: (district) => `첫 방문에 맞는 ${district} 공개 장소를 확인하세요.` },
    food: { label: (district) => `${district} 맛집`, description: (district) => `${district}의 공개 음식점, 메뉴, 웨이팅 정보를 확인하세요.` },
    rainyDay: { label: () => "비 오는 날 갈 곳", description: (district) => `비 오는 날에도 가기 좋은 ${district} 공개 장소를 확인하세요.` },
    solo: { label: () => "혼자 가기 좋은 곳", description: (district) => `혼자 이용하기 좋은 ${district} 공개 장소를 확인하세요.` },
    lateNight: { label: () => "밤 10시 이후 갈 곳", description: (district) => `늦은 시간에도 고려할 수 있는 ${district} 공개 장소를 확인하세요.` },
    luggage: { label: () => "짐 보관 가능한 곳", description: (district) => `${district}에서 이용할 수 있는 공개 짐 보관 장소를 확인하세요.` },
  },
  zh: {
    firstGwangalli: { label: (district) => `第一次去${district}`, description: (district) => `查看适合第一次到访${district}的已公开地点。` },
    food: { label: (district) => `${district}美食`, description: (district) => `查看${district}已公开的餐厅、菜单和排队信息。` },
    rainyDay: { label: () => "下雨天去哪里", description: (district) => `查看${district}下雨天也适合前往的已公开地点。` },
    solo: { label: () => "适合一个人去", description: (district) => `查看${district}适合独自前往的已公开地点。` },
    lateNight: { label: () => "晚上10点以后去哪", description: (district) => `查看${district}深夜仍可考虑的已公开地点。` },
    luggage: { label: () => "行李寄存", description: (district) => `查看${district}已公开的行李寄存地点。` },
  },
  en: {
    firstGwangalli: { label: (district) => `First time in ${district}`, description: (district) => `See published ${district} places suited to a first visit.` },
    food: { label: (district) => `${district} food`, description: (district) => `See published restaurants, menus, and wait information in ${district}.` },
    rainyDay: { label: () => "Rainy-day places", description: (district) => `See published ${district} places that still work in the rain.` },
    solo: { label: () => "Good for solo travel", description: (district) => `See published ${district} places that work well alone.` },
    lateNight: { label: () => "After 10 PM", description: (district) => `See published ${district} places to consider late at night.` },
    luggage: { label: () => "Luggage storage", description: (district) => `See published luggage storage places in ${district}.` },
  },
  ja: {
    firstGwangalli: { label: (district) => `初めての${district}`, description: (district) => `${district}を初めて訪れる人向けの公開スポットを確認。` },
    food: { label: (district) => `${district}グルメ`, description: (district) => `${district}の公開中の飲食店、メニュー、待ち時間情報を確認。` },
    rainyDay: { label: () => "雨の日に行く場所", description: (district) => `${district}で雨の日にも行きやすい公開スポットを確認。` },
    solo: { label: () => "一人で行きやすい場所", description: (district) => `${district}で一人でも利用しやすい公開スポットを確認。` },
    lateNight: { label: () => "夜10時以降に行く場所", description: (district) => `${district}で夜遅くにも検討できる公開スポットを確認。` },
    luggage: { label: () => "荷物預かり", description: (district) => `${district}で利用できる公開中の荷物預かりスポットを確認。` },
  },
};

const placeTargets: Record<HomeIntentKey, PlaceTarget> = {
  firstGwangalli: chinaFilterTarget("firstBusan"),
  food: categoryTarget("restaurant"),
  rainyDay: chinaFilterTarget("rainyDay"),
  solo: chinaFilterTarget("solo"),
  lateNight: chinaFilterTarget("openNight"),
  luggage: categoryTarget("luggage"),
};

export function resolveHomeIntentCards({ guides, places, locale, district }: ResolveHomeIntentCardsInput): ResolvedHomeIntentCard[] {
  const publicGuides = guides.filter((guide) => guide.status === "PUBLISHED");
  const publicPlaces = places
    .filter(isPublicPlace)
    .filter((place) => !district || getBusanDistrictKey(place) === district);

  return homeIntentCards[locale].map((card) => {
    const displayCard = district ? withDistrictIntentCopy(card, district, locale) : card;
    const hasMappedPlace = publicPlaces.some((place) => getHomeIntentKeysFromTags(place.tags).includes(card.key));

    if (hasMappedPlace) {
      return {
        ...displayCard,
        destination: "places",
        href: withLocale(withDistrict(`/places?intent=${card.key}`, district), locale),
      };
    }

    const matchedGuide = findGuideByTerms(publicGuides, locale, card.terms);

    if (matchedGuide) {
      return {
        ...displayCard,
        destination: "guide",
        href: withLocale(`/guides/${matchedGuide.slug}`, locale),
      };
    }

    const target = placeTargets[card.key];
    const hasStructuredMatch = target.hasMatch(publicPlaces);
    const hasTagMatch = publicPlaces.some((place) => placeMatchesLegacyIntentTag(place, card));

    if (hasStructuredMatch || hasTagMatch) {
      return {
        ...displayCard,
        destination: "places",
        href: withLocale(withDistrict(hasStructuredMatch ? target.href : `/places?search=${encodeURIComponent(card.search)}`, district), locale),
      };
    }

    return {
      ...displayCard,
      destination: "pending",
      href: null,
    };
  });
}

function withDistrictIntentCopy(card: HomeIntentCopy, district: BusanDistrictKey, locale: Locale): HomeIntentCopy {
  const districtLabel = getBusanDistrictLabel(district, locale);
  const copy = districtIntentCopy[locale][card.key];
  return {
    ...card,
    label: copy.label(districtLabel),
    description: copy.description(districtLabel),
  };
}

function withDistrict(href: string, district?: BusanDistrictKey) {
  if (!district) return href;
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("region", district);
  return `${pathname}?${params.toString()}`;
}

function placeMatchesLegacyIntentTag(place: PlaceWithRelations, card: HomeIntentCopy) {
  const tagText = (place.tags ?? [])
    .map((tag) => `${tag.label_zh} ${tag.label_ko} ${tag.slug}`)
    .join(" ")
    .toLowerCase();
  const searchTerms = card.search.toLowerCase().split(/\s+/).filter(Boolean);
  const intentTerms = card.terms
    .map((term) => term.toLowerCase())
    .filter((term) => term !== "광안리" && term !== "부산");

  return Boolean(
    tagText &&
      ((searchTerms.length > 0 && searchTerms.every((term) => tagText.includes(term))) ||
        intentTerms.some((term) => tagText.includes(term))),
  );
}

export function getProblemGuides(guides: Guide[], locale: Locale) {
  return [...guides]
    .filter((guide) => guide.status === "PUBLISHED")
    .filter((guide) => guide.guide_type !== "PRACTICAL" || guide.is_featured)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order)
    .filter((guide) => {
      const text = buildGuideSearchText(guide, locale);
      return homeIntentCards[locale].some((card) => card.terms.some((term) => text.includes(term.toLowerCase())));
    });
}

function findGuideByTerms(guides: Guide[], locale: Locale, terms: string[]) {
  return guides.find((guide) => {
    const text = buildGuideSearchText(guide, locale);
    return terms.some((term) => text.includes(term.toLowerCase()));
  });
}

function buildGuideSearchText(guide: Guide, locale: Locale) {
  return [
    guide[`title_${locale}`],
    guide[`description_${locale}`],
    guide.title_ko,
    guide.title_zh,
    guide.title_en,
    guide.title_ja,
    guide.area,
    guide.recommended_for[locale],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function categoryTarget(category: PlaceWithRelations["category"]): PlaceTarget {
  return {
    href: `/places?category=${category}`,
    hasMatch: (places) => places.some((place) => place.category === category),
  };
}

function chinaFilterTarget(queryKey: string): PlaceTarget {
  return {
    href: `/places?${queryKey}=true`,
    hasMatch: (places) => {
      const filter = getChinaFilterByQueryKey(queryKey);
      return Boolean(filter && places.some((place) => filter.match(place)));
    },
  };
}
