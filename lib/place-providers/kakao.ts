import { normalizeCoordinates, text } from "@/lib/place-providers/normalize";
import type { NormalizedPlace, PlaceProvider } from "@/lib/place-providers/types";

type KakaoPlaceDocument = {
  id?: unknown;
  place_name?: unknown;
  category_name?: unknown;
  category_group_name?: unknown;
  phone?: unknown;
  address_name?: unknown;
  road_address_name?: unknown;
  x?: unknown;
  y?: unknown;
  place_url?: unknown;
};

export const kakaoMapsProvider: PlaceProvider = {
  id: "kakao",
  async lookup(context) {
    const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
    if (!apiKey) return null;

    const parsed = [...context.parsedUrls].reverse().find((item) => item.provider === "kakao");
    const query = parsed?.title?.trim();
    if (!parsed || !query) return null;

    const endpoint = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("size", "5");
    if (parsed.longitude !== undefined && parsed.latitude !== undefined) {
      endpoint.searchParams.set("x", String(parsed.longitude));
      endpoint.searchParams.set("y", String(parsed.latitude));
      endpoint.searchParams.set("radius", "1000");
      endpoint.searchParams.set("sort", "distance");
    }

    const response = await context.fetcher(endpoint, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw providerError("Kakao 장소 검색에 실패했습니다.", response.status);
    }

    const body = await response.json() as { documents?: KakaoPlaceDocument[] };
    const item = selectKakaoItem(body.documents ?? [], parsed.placeId, query, parsed.latitude, parsed.longitude);
    return item ? normalizeKakaoItem(item) : null;
  },
};

function selectKakaoItem(
  items: KakaoPlaceDocument[],
  placeId: string | undefined,
  query: string,
  latitude?: number,
  longitude?: number,
) {
  if (placeId) {
    const idMatch = items.find((item) => text(item.id) === placeId);
    if (idMatch) return idMatch;
  }

  const normalizedQuery = normalizeName(query);
  const nameMatch = items.find((item) => normalizeName(text(item.place_name) ?? "") === normalizedQuery);

  if (nameMatch && (!placeId || isNearCoordinates(nameMatch, latitude, longitude))) {
    return nameMatch;
  }

  if (placeId) {
    return null;
  }

  const nearbyItem = items
    .map((item) => ({ item, distance: coordinateDistanceMeters(item, latitude, longitude) }))
    .filter((candidate): candidate is { item: KakaoPlaceDocument; distance: number } => candidate.distance !== null)
    .sort((a, b) => a.distance - b.distance)[0];

  if (nearbyItem && nearbyItem.distance <= 1500) {
    return nearbyItem.item;
  }

  return items.length === 1 ? items[0] : null;
}

function normalizeKakaoItem(item: KakaoPlaceDocument): Partial<NormalizedPlace> {
  const coordinates = normalizeCoordinates(item.y, item.x);

  return {
    providerPlaceId: text(item.id),
    name: text(item.place_name),
    category: text(item.category_name) ?? text(item.category_group_name),
    types: text(item.category_name)?.split(">").map((value) => value.trim()).filter(Boolean),
    addressKo: text(item.address_name),
    roadAddressKo: text(item.road_address_name),
    formattedAddress: text(item.road_address_name) ?? text(item.address_name),
    ...coordinates,
    phone: text(item.phone),
    providerUri: text(item.place_url),
    fetchedAt: new Date().toISOString(),
    raw: item,
  };
}

function normalizeName(value: string) {
  return value.replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}

function isNearCoordinates(item: KakaoPlaceDocument, latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) return true;
  const distance = coordinateDistanceMeters(item, latitude, longitude);
  return distance !== null && distance <= 1500;
}

function coordinateDistanceMeters(item: KakaoPlaceDocument, latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) return null;
  const itemCoordinates = normalizeCoordinates(item.y, item.x);
  if (!itemCoordinates) return null;

  const latitudeDelta = (itemCoordinates.latitude - latitude) * 111_320;
  const longitudeDelta = (itemCoordinates.longitude - longitude) * 111_320 * Math.cos(latitude * Math.PI / 180);
  return Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2);
}

function providerError(message: string, providerStatus: number) {
  return Object.assign(new Error(message), { status: 502, expose: true, providerStatus });
}
