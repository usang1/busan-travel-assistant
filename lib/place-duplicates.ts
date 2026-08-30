import { calculateDistanceMeters } from "@/lib/location";
import { normalizeCoordinates } from "@/lib/place-providers/normalize";
import type { PlacePayload, PlaceWithRelations } from "@/types/database";

export type PlaceDuplicateMatch = {
  placeId: string;
  placeName: string;
  level: "exact" | "possible";
  reason: "provider_id" | "coordinates" | "name_address";
  distanceMeters?: number;
};

export function findPlaceDuplicateMatches(
  payload: PlacePayload,
  places: PlaceWithRelations[],
  excludePlaceId?: string,
): PlaceDuplicateMatch[] {
  const source = payload.source;
  const coordinates = normalizeCoordinates(payload.latitude, payload.longitude);
  const name = payload.name_ko || payload.name_zh;
  const address = payload.address_ko || payload.address_zh || payload.address || "";

  return places
    .filter((place) => place.id !== excludePlaceId)
    .map((place): PlaceDuplicateMatch | null => {
      if (
        source?.external_id &&
        place.sources?.some((item) => item.provider === source.provider && item.external_id === source.external_id)
      ) {
        return { placeId: place.id, placeName: place.name_ko || place.name_zh, level: "exact", reason: "provider_id" };
      }

      const existingCoordinates = normalizeCoordinates(place.latitude, place.longitude);
      if (coordinates && existingCoordinates) {
        const distanceMeters = calculateDistanceMeters(coordinates, existingCoordinates);
        if (distanceMeters <= 30) {
          return { placeId: place.id, placeName: place.name_ko || place.name_zh, level: "possible", reason: "coordinates", distanceMeters };
        }
      }

      const nameScore = similarity(name, place.name_ko || place.name_zh);
      const existingAddress = place.address_ko || place.address_zh || place.address || "";
      const addressScore = similarity(address, existingAddress);
      if (nameScore >= 0.85 && addressScore >= 0.65) {
        return { placeId: place.id, placeName: place.name_ko || place.name_zh, level: "possible", reason: "name_address" };
      }

      return null;
    })
    .filter((match): match is PlaceDuplicateMatch => Boolean(match));
}

function similarity(left: string, right: string) {
  const a = normalizeComparable(left);
  const b = normalizeComparable(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  if (!aPairs.length || !bPairs.length) return 0;
  const remaining = [...bPairs];
  let overlap = 0;

  for (const pair of aPairs) {
    const index = remaining.indexOf(pair);
    if (index >= 0) {
      overlap += 1;
      remaining.splice(index, 1);
    }
  }

  return (2 * overlap) / (aPairs.length + bPairs.length);
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣一-龥]/g, "");
}

function bigrams(value: string) {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}
