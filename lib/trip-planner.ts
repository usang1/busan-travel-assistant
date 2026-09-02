import { calculateDistanceMeters } from "@/lib/location";
import type { PlaceWithRelations } from "@/types/database";

export const maxTripDays = 31;

export type TripPlacePosition = {
  placeId: string;
  dayNumber: number;
  sortOrder: number;
};

export function getTripDayCount(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return 1;
  return Math.max(1, Math.min(maxTripDays, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1));
}

export function getTripDayDate(startDate: string, dayNumber: number) {
  const start = parseDate(startDate);
  if (!start) return "";
  start.setUTCDate(start.getUTCDate() + Math.max(0, dayNumber - 1));
  return start.toISOString().slice(0, 10);
}

export function autoArrangeTripPlaces(places: PlaceWithRelations[], dayCount: number): TripPlacePosition[] {
  const uniquePlaces = Array.from(new Map(
    places.filter((place) => place.is_active).map((place) => [place.id, place]),
  ).values());
  const days = Math.max(1, Math.min(maxTripDays, Math.round(dayCount)));
  if (!uniquePlaces.length) return [];

  const geographicallySorted = [...uniquePlaces].sort((a, b) => coordinateKey(a) - coordinateKey(b));
  const perDay = Math.max(1, Math.ceil(geographicallySorted.length / days));

  return Array.from({ length: days }, (_, dayIndex) => {
    const group = geographicallySorted.slice(dayIndex * perDay, (dayIndex + 1) * perDay);
    return orderDayPlaces(group).map((place, sortOrder) => ({
      placeId: place.id,
      dayNumber: dayIndex + 1,
      sortOrder,
    }));
  }).flat();
}

function orderDayPlaces(places: PlaceWithRelations[]) {
  if (places.length <= 1) return places;
  const remaining = [...places];
  const ordered: PlaceWithRelations[] = [];
  let current = remaining.splice(findStartIndex(remaining), 1)[0];
  ordered.push(current);

  while (remaining.length) {
    const nextIndex = remaining
      .map((place, index) => ({ index, score: transitionCost(current, place) }))
      .sort((a, b) => a.score - b.score)[0].index;
    current = remaining.splice(nextIndex, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

function findStartIndex(places: PlaceWithRelations[]) {
  const preferred = ["attraction", "shopping", "photo_spot", "cafe", "restaurant", "bar", "luggage"];
  return places
    .map((place, index) => {
      const categoryOrder = preferred.indexOf(place.category);
      const openingMinutes = openingStartMinutes(place.opening_hours);
      return {
        index,
        score: (openingMinutes ?? 12 * 60) + (categoryOrder < 0 ? preferred.length : categoryOrder) * 20,
      };
    })
    .sort((a, b) => a.score - b.score)[0]?.index ?? 0;
}

function transitionCost(previous: PlaceWithRelations, candidate: PlaceWithRelations) {
  let cost = previous.category === candidate.category ? 1_200 : 0;
  if (!candidate.opening_hours) cost += 120;

  if (
    typeof previous.latitude === "number" && typeof previous.longitude === "number" &&
    typeof candidate.latitude === "number" && typeof candidate.longitude === "number"
  ) {
    cost += calculateDistanceMeters(
      { latitude: previous.latitude, longitude: previous.longitude },
      { latitude: candidate.latitude, longitude: candidate.longitude },
    );
  } else {
    cost += 2_000;
  }

  return cost;
}

function coordinateKey(place: PlaceWithRelations) {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return Number.MAX_SAFE_INTEGER;
  return place.latitude * 10_000 + place.longitude;
}

function openingStartMinutes(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\D|$)/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
