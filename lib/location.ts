import type { PlaceCategory, PlaceWithRelations } from "@/types/database";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type OpeningStatus = "open" | "closing_soon" | "closed" | "unknown";

export const gwangalliCenter: Coordinates = {
  latitude: 35.1532,
  longitude: 129.1186,
};

export const mapCategories: PlaceCategory[] = ["restaurant", "cafe", "photo_spot", "attraction", "luggage"];

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
  const normalized = openingHours.trim();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("24")) {
    return "open";
  }

  const match = normalized.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/);

  if (!match) {
    return "unknown";
  }

  const [, openHourRaw, openMinuteRaw, closeHourRaw, closeMinuteRaw] = match;
  const openMinutes = Number(openHourRaw) * 60 + Number(openMinuteRaw);
  let closeMinutes = Number(closeHourRaw) * 60 + Number(closeMinuteRaw);
  let currentMinutes = date.getHours() * 60 + date.getMinutes();

  if (closeMinutes <= openMinutes) {
    closeMinutes += 24 * 60;

    if (currentMinutes < openMinutes) {
      currentMinutes += 24 * 60;
    }
  }

  if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
    return "closed";
  }

  if (closeMinutes - currentMinutes <= 60) {
    return "closing_soon";
  }

  return "open";
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
