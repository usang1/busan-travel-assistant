import { formatDistance, gwangalliCenter, calculateDistanceMeters, hasCoordinates } from "@/lib/location";
import { buildChinaPlaceSummary, waitingLabel } from "@/lib/place-china/format";
import { formatPriceRange, formatWon } from "@/lib/place-store";
import { getLocalizedMenuItem, getPlaceContent, type Locale, ui } from "@/lib/i18n";
import type { ChinaWaitingLevel, PlaceFactTristate, PlaceWithRelations } from "@/types/database";

export const farFromGwangalliWarningMeters = 5000;

export function distanceFromGwangalli(place: PlaceWithRelations) {
  if (!hasCoordinates(place)) {
    return null;
  }

  return calculateDistanceMeters(gwangalliCenter, {
    latitude: place.latitude,
    longitude: place.longitude,
  });
}

export function isNearGwangalli(place: PlaceWithRelations) {
  const distance = distanceFromGwangalli(place);
  return distance === null || distance <= farFromGwangalliWarningMeters;
}

export function formatPlaceDistance(meters: number | null, locale: Locale) {
  return formatDistance(meters, locale);
}

export function getRepresentativeMenu(place: PlaceWithRelations, locale: Locale) {
  const item = [...place.menu_items].sort((a, b) => Number(b.is_recommended) - Number(a.is_recommended) || a.sort_order - b.sort_order)[0];

  if (item) {
    const menu = getLocalizedMenuItem(item, locale);
    return {
      name: menu.name,
      secondaryName: menu.secondaryName,
      price: item.price === null ? ui[locale].common.priceUnknown : formatWon(item.price, locale),
      orderKo: `${item.name_ko} 1인분 주세요.`,
    };
  }

  const content = getPlaceContent(place, locale);
  const order = content.recommendedOrder.trim();

  return order
    ? { name: order, secondaryName: "", price: ui[locale].common.priceUnknown, orderKo: place.recommended_order_ko.trim() }
    : null;
}

export function getPerPersonPrice(place: PlaceWithRelations, locale: Locale) {
  return formatPriceRange(place, locale);
}

export function getWaitingDisplay(place: PlaceWithRelations, locale: Locale) {
  const level = place.china_info?.waiting_level;
  const content = getPlaceContent(place, locale);

  if (level && level !== "unknown") {
    return localizedWaiting(level, locale);
  }

  return content.waitingInfo.trim() || ui[locale].common.noInfo;
}

export function getSoloDisplay(place: PlaceWithRelations, locale: Locale) {
  return localizedTristate(place.china_info?.solo_friendly ?? (place.solo_friendly ? "yes" : "unknown"), locale, {
    yes: { zh: "一个人OK", en: "Solo OK", ja: "一人OK", ko: "혼밥 가능" },
    no: { zh: "不太适合单人", en: "Not ideal solo", ja: "一人利用は難しい", ko: "혼밥 어려움" },
    unknown: {
      zh: "单人用餐确认中",
      en: "Solo dining needs checking",
      ja: "一人利用確認中",
      ko: "혼밥 확인 필요",
    },
  });
}

export function getTravelerAdvantage(place: PlaceWithRelations, locale: Locale) {
  const summary = buildChinaPlaceSummary(place.china_info);
  const positive = locale === "zh" ? summary.tags.filter((tag) => tag !== "信息确认中").slice(0, 2).join(" · ") : "";

  if (positive) {
    return positive;
  }

  return ui[locale].common.noInfo;
}

export function getDistanceWarning(distanceMeters: number | null, locale: Locale) {
  if (distanceMeters === null || distanceMeters <= farFromGwangalliWarningMeters) {
    return "";
  }

  return {
    zh: "距离广安里较远，出发前请确认移动路线。",
    en: "Far from Gwangalli. Check the route before leaving.",
    ja: "広安里から離れています。出発前に移動ルートを確認してください。",
    ko: "광안리 기준으로 거리가 멉니다. 출발 전 이동 경로를 확인하세요.",
  }[locale];
}

function localizedWaiting(value: Exclude<ChinaWaitingLevel, "unknown">, locale: Locale) {
  if (locale === "zh") return waitingLabel(value);

  const labels: Record<Exclude<ChinaWaitingLevel, "unknown">, Record<Exclude<Locale, "zh">, string>> = {
    none: { en: "Little or no wait", ja: "待ち時間ほぼなし", ko: "웨이팅 거의 없음" },
    short: { en: "About 5-10 min", ja: "約5〜10分", ko: "약 5~10분" },
    moderate: { en: "About 10-20 min", ja: "約10〜20分", ko: "약 10~20분" },
    long: { en: "About 20-40 min", ja: "約20〜40分", ko: "약 20~40분" },
    extreme: { en: "Over 40 min", ja: "40分以上", ko: "40분 이상" },
    varies: { en: "Varies by time", ja: "時間帯で変動", ko: "시간대별 변동" },
  };

  return labels[value][locale];
}

function localizedTristate(
  value: PlaceFactTristate,
  locale: Locale,
  labels: Record<PlaceFactTristate, Record<Locale, string>>,
) {
  return labels[value][locale];
}
