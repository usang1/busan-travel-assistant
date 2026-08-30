import type { Locale } from "@/lib/i18n";
import type { PlaceCategory, PlaceWithRelations } from "@/types/database";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type OpeningStatus = "open" | "closing_soon" | "closed" | "unknown";

export type OpeningStatusDetail = {
  status: OpeningStatus;
  closeTime?: string;
  nextOpenTime?: string;
  nextOpenDay?: "today" | "tomorrow";
  isTwentyFourHours: boolean;
};

export const gwangalliCenter: Coordinates = {
  latitude: 35.1532,
  longitude: 129.1186,
};

export const mapCategories: PlaceCategory[] = ["restaurant", "cafe", "bar", "attraction", "shopping", "photo_spot", "luggage"];

export function hasCoordinates(place: Pick<PlaceWithRelations, "latitude" | "longitude">): place is PlaceWithRelations & Coordinates {
  return typeof place.latitude === "number" && typeof place.longitude === "number";
}

export function calculateDistanceMeters(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6371000;
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

export function formatDistance(meters: number | null) {
  if (meters === null) {
    return "距离未知";
  }

  if (meters < 1000) {
    return `${meters}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}

export function estimateWalkingMinutes(meters: number | null) {
  if (meters === null) {
    return null;
  }

  return Math.max(1, Math.round(meters / 72));
}

export function getPlaceDistance(place: PlaceWithRelations, origin: Coordinates) {
  if (!hasCoordinates(place)) {
    return null;
  }

  return calculateDistanceMeters(origin, {
    latitude: place.latitude,
    longitude: place.longitude,
  });
}

export function getOpeningStatus(openingHours: string, date = new Date()): OpeningStatus {
  return getOpeningStatusDetail(openingHours, date).status;
}

export function getOpeningStatusDetail(openingHours: string, date = new Date()): OpeningStatusDetail {
  const normalized = openingHours.trim();

  if (!normalized) {
    return { status: "unknown", isTwentyFourHours: false };
  }

  if (normalized.includes("24시간") || normalized.toLowerCase().includes("24h")) {
    return { status: "open", isTwentyFourHours: true };
  }

  const match = normalized.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);

  if (!match) {
    return { status: "unknown", isTwentyFourHours: false };
  }

  const [, openHourRaw, openMinuteRaw, closeHourRaw, closeMinuteRaw] = match;
  const openMinutes = Number(openHourRaw) * 60 + Number(openMinuteRaw);
  const rawCloseMinutes = Number(closeHourRaw) * 60 + Number(closeMinuteRaw);
  const closeLabel = `${closeHourRaw.padStart(2, "0")}:${closeMinuteRaw}`;
  const openLabel = `${openHourRaw.padStart(2, "0")}:${openMinuteRaw}`;
  let closeMinutes = rawCloseMinutes;
  let currentMinutes = getSeoulMinutes(date);

  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60;

    if (currentMinutes < openMinutes) {
      currentMinutes += 24 * 60;
    }
  }

  if (currentMinutes < openMinutes) {
    return {
      status: "closed",
      nextOpenTime: openLabel,
      nextOpenDay: "today",
      isTwentyFourHours: false,
    };
  }

  if (currentMinutes > closeMinutes) {
    return {
      status: "closed",
      nextOpenTime: openLabel,
      nextOpenDay: "tomorrow",
      isTwentyFourHours: false,
    };
  }

  if (closeMinutes - currentMinutes <= 60) {
    return {
      status: "closing_soon",
      closeTime: closeLabel,
      isTwentyFourHours: false,
    };
  }

  return {
    status: "open",
    closeTime: closeLabel,
    isTwentyFourHours: false,
  };
}

export function getOpeningStatusLabel(status: OpeningStatus) {
  if (status === "open") {
    return { zh: "营业中", ko: "영업 중", tone: "green" as const };
  }

  if (status === "closing_soon") {
    return { zh: "即将关门", ko: "곧 마감", tone: "amber" as const };
  }

  if (status === "closed") {
    return { zh: "今天可能结束", ko: "영업 종료 가능", tone: "default" as const };
  }

  return { zh: "时间待确认", ko: "시간 확인 필요", tone: "blue" as const };
}

export function formatOpeningStatus(openingHours: string, locale: Locale = "zh", date = new Date()) {
  const detail = getOpeningStatusDetail(openingHours, date);

  if (detail.status === "unknown") {
    return {
      text: {
        zh: "营业时间待确认",
        en: "Hours unknown",
        ja: "営業時間未確認",
        ko: "영업시간 확인 필요",
      }[locale],
      tone: "blue" as const,
    };
  }

  if (detail.isTwentyFourHours) {
    return {
      text: {
        zh: "营业中 · 24小时",
        en: "Open · 24 hours",
        ja: "営業中 · 24時間",
        ko: "영업중 · 24시간",
      }[locale],
      tone: "green" as const,
    };
  }

  if (detail.status === "open" || detail.status === "closing_soon") {
    const prefix = detail.status === "open"
      ? { zh: "营业中", en: "Open", ja: "営業中", ko: "영업중" }[locale]
      : { zh: "即将关门", en: "Closing soon", ja: "まもなく終了", ko: "곧 마감" }[locale];

    return {
      text: detail.closeTime ? `${prefix} · ${detail.closeTime} ${closingWord(locale)}` : prefix,
      tone: detail.status === "open" ? ("green" as const) : ("amber" as const),
    };
  }

  const day = detail.nextOpenDay === "tomorrow"
    ? { zh: "明天", en: "Tomorrow", ja: "明日", ko: "내일" }[locale]
    : { zh: "今天", en: "Today", ja: "今日", ko: "오늘" }[locale];

  return {
    text: detail.nextOpenTime
      ? `${closedWord(locale)} · ${day} ${detail.nextOpenTime} ${openingWord(locale)}`
      : closedWord(locale),
    tone: "default" as const,
  };
}

function getSeoulMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

function closingWord(locale: Locale) {
  return { zh: "结束", en: "close", ja: "終了", ko: "종료" }[locale];
}

function openingWord(locale: Locale) {
  return { zh: "营业", en: "opens", ja: "営業", ko: "영업" }[locale];
}

function closedWord(locale: Locale) {
  return { zh: "营业结束", en: "Closed", ja: "営業終了", ko: "영업종료" }[locale];
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
