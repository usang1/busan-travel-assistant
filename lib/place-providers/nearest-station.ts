import { normalizeCoordinates } from "@/lib/place-providers/normalize";

export type NearestStation = {
  name: string;
  distanceMeters: number;
  walkingMinutes: number;
  providerPlaceId?: string;
};

export async function resolveNearestStation(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<NearestStation | null> {
  const coordinates = normalizeCoordinates(latitude, longitude);
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!coordinates || !apiKey) return null;

  const endpoint = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  endpoint.searchParams.set("category_group_code", "SW8");
  endpoint.searchParams.set("x", String(coordinates.longitude));
  endpoint.searchParams.set("y", String(coordinates.latitude));
  endpoint.searchParams.set("radius", "2000");
  endpoint.searchParams.set("sort", "distance");
  endpoint.searchParams.set("size", "1");

  const response = await fetcher(endpoint, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const body = await response.json() as { documents?: Array<{ id?: string; place_name?: string; distance?: string }> };
  const station = body.documents?.[0];
  const distanceMeters = Number(station?.distance);
  if (!station?.place_name || !Number.isFinite(distanceMeters)) return null;

  return {
    name: station.place_name.trim(),
    distanceMeters,
    walkingMinutes: Math.max(1, Math.round(distanceMeters / 72)),
    providerPlaceId: station.id,
  };
}
