import "server-only";

import type { Coordinates } from "@/lib/location";
import {
  buildCoordinateBounds,
  nearbyPopularRadiusMeters,
  relatedPlaceRadiusMeters,
  scoreNearbyPopularPlace,
  scoreRelatedPlace,
} from "@/lib/place-recommendation-score";
import { getPublicPlacesByIds, getPublicPlacesInBounds } from "@/lib/place-store";
import { getSupabaseClient } from "@/lib/supabase";
import type { PlaceCategory, PlaceRankingCollection, PlaceWithRelations } from "@/types/database";

type PlaceRankingRow = {
  place_id: string;
  save_count: number | string;
  recent_save_count: number | string;
};

export async function getPlaceRankings(options: { limit?: number; category?: PlaceCategory; region?: string } = {}): Promise<PlaceRankingCollection> {
  const client = getSupabaseClient();
  if (!client) return { popular: [], trending: [], error: "Supabase가 설정되지 않았습니다." };

  const limit = Math.max(1, Math.min(options.limit ?? 6, 12));
  const params = {
    result_limit: limit,
    category_filter: options.category ?? null,
    region_filter: options.region?.trim() || null,
  };
  const [popularResult, trendingResult] = await Promise.all([
    client.rpc("get_place_rankings", { ...params, ranking_period: "all" }),
    client.rpc("get_place_rankings", { ...params, ranking_period: "week" }),
  ]);

  const error = popularResult.error ?? trendingResult.error;
  if (error) return { popular: [], trending: [], error: error.message };

  const popularRows = normalizeRankingRows(popularResult.data);
  const trendingRows = normalizeRankingRows(trendingResult.data);
  const placeIds = Array.from(new Set([...popularRows, ...trendingRows].map((row) => row.place_id)));
  const places = await getPublicPlacesByIds(placeIds, client);
  const byId = new Map(places.map((place) => [place.id, place]));

  return {
    popular: applyRanking(popularRows, byId),
    trending: applyRanking(trendingRows, byId),
  };
}

export async function getRelatedPlaces(place: PlaceWithRelations, limit = 4) {
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") return [];
  const bounds = buildCoordinateBounds(
    { latitude: place.latitude, longitude: place.longitude },
    relatedPlaceRadiusMeters,
  );
  const candidates = await getPublicPlacesInBounds(bounds, 60);

  return candidates
    .map((candidate) => ({ candidate, result: scoreRelatedPlace(place, candidate) }))
    .filter((item): item is { candidate: PlaceWithRelations; result: { score: number; distance: number } } => item.result !== null)
    .sort((a, b) => b.result.score - a.result.score || a.result.distance - b.result.distance)
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map(({ candidate, result }) => ({ ...candidate, recommendation_distance: result.distance }));
}

export async function getNearbyPopularPlaces(origin: Coordinates, limit = 4) {
  const bounds = buildCoordinateBounds(origin, nearbyPopularRadiusMeters);
  const candidates = await getPublicPlacesInBounds(bounds, 60);

  return candidates
    .map((place) => ({ place, result: scoreNearbyPopularPlace(origin, place) }))
    .filter((item): item is { place: PlaceWithRelations; result: { score: number; distance: number } } => item.result !== null)
    .sort((a, b) => b.result.score - a.result.score || a.result.distance - b.result.distance)
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map(({ place, result }) => ({ ...place, recommendation_distance: result.distance }));
}

function normalizeRankingRows(value: unknown): PlaceRankingRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.place_id !== "string") return [];
    return [{
      place_id: item.place_id,
      save_count: finiteCount(item.save_count),
      recent_save_count: finiteCount(item.recent_save_count),
    }];
  });
}

function applyRanking(rows: PlaceRankingRow[], places: Map<string, PlaceWithRelations>) {
  return rows.flatMap((row) => {
    const place = places.get(row.place_id);
    return place ? [{
      ...place,
      save_count: finiteCount(row.save_count),
      recent_save_count: finiteCount(row.recent_save_count),
    }] : [];
  });
}

function finiteCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
