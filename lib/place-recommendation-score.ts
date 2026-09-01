import { calculateDistanceMeters, type Coordinates } from "@/lib/location";
import type { PlaceCategory, PlaceWithRelations } from "@/types/database";

export const relatedPlaceRadiusMeters = 3_000;
export const nearbyPopularRadiusMeters = 3_000;

const complementaryCategories: Record<PlaceCategory, PlaceCategory[]> = {
  restaurant: ["cafe", "attraction", "shopping"],
  cafe: ["attraction", "restaurant", "shopping"],
  bar: ["restaurant", "cafe", "attraction"],
  attraction: ["restaurant", "cafe", "shopping"],
  shopping: ["cafe", "restaurant", "attraction"],
  photo_spot: ["cafe", "restaurant", "attraction"],
  luggage: ["restaurant", "cafe", "attraction"],
};

export function buildCoordinateBounds(origin: Coordinates, radiusMeters: number) {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeScale = Math.max(0.2, Math.cos(origin.latitude * Math.PI / 180));
  const longitudeDelta = radiusMeters / (111_320 * longitudeScale);

  return {
    minLatitude: origin.latitude - latitudeDelta,
    maxLatitude: origin.latitude + latitudeDelta,
    minLongitude: origin.longitude - longitudeDelta,
    maxLongitude: origin.longitude + longitudeDelta,
  };
}

export function scoreRelatedPlace(origin: PlaceWithRelations, candidate: PlaceWithRelations) {
  const distance = distanceBetweenPlaces(origin, candidate);
  if (distance === null || distance > relatedPlaceRadiusMeters || origin.id === candidate.id) return null;

  const preferred = complementaryCategories[origin.category];
  const categoryScore = preferred.includes(candidate.category)
    ? 34 - preferred.indexOf(candidate.category) * 5
    : candidate.category === origin.category ? 8 : 14;
  const distanceScore = Math.max(0, 42 * (1 - distance / relatedPlaceRadiusMeters));
  const saveScore = Math.min(18, Math.log2((candidate.save_count ?? 0) + 1) * 4);
  const qualityScore = getDataQualityScore(candidate);

  return { score: categoryScore + distanceScore + saveScore + qualityScore, distance };
}

export function scoreNearbyPopularPlace(origin: Coordinates, place: PlaceWithRelations) {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return null;
  if ((place.save_count ?? 0) <= 0) return null;
  const distance = calculateDistanceMeters(origin, { latitude: place.latitude, longitude: place.longitude });
  if (distance > nearbyPopularRadiusMeters) return null;

  const distanceScore = Math.max(0, 42 * (1 - distance / nearbyPopularRadiusMeters));
  const saveScore = Math.min(42, Math.log2((place.save_count ?? 0) + 1) * 8);
  return { score: distanceScore + saveScore + getDataQualityScore(place), distance };
}

export function getDataQualityScore(place: PlaceWithRelations) {
  let score = 0;
  if (place.short_description_ko || place.short_description_zh) score += 2;
  if (place.address_ko || place.address_zh) score += 2;
  if (place.opening_hours) score += 2;
  if (place.thumbnail_url) score += 1;
  if (place.phone || place.website) score += 1;
  if (place.menu_items.length || place.tags.length) score += 2;
  return score;
}

function distanceBetweenPlaces(origin: PlaceWithRelations, candidate: PlaceWithRelations) {
  if (
    typeof origin.latitude !== "number" ||
    typeof origin.longitude !== "number" ||
    typeof candidate.latitude !== "number" ||
    typeof candidate.longitude !== "number"
  ) return null;

  return calculateDistanceMeters(
    { latitude: origin.latitude, longitude: origin.longitude },
    { latitude: candidate.latitude, longitude: candidate.longitude },
  );
}
