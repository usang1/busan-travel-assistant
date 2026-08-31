import { normalizeCoordinates, stripHtml, text } from "@/lib/place-providers/normalize";
import type { NormalizedPlace, PlaceProvider } from "@/lib/place-providers/types";

type NaverLocalItem = {
  title?: unknown;
  link?: unknown;
  category?: unknown;
  description?: unknown;
  telephone?: unknown;
  address?: unknown;
  roadAddress?: unknown;
  mapx?: unknown;
  mapy?: unknown;
};

export const naverMapsProvider: PlaceProvider = {
  id: "naver",
  async lookup(context) {
    const hubClientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim();
    const hubClientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();
    const legacyClientId = process.env.NAVER_SEARCH_CLIENT_ID?.trim();
    const legacyClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET?.trim();
    const clientId = hubClientId || legacyClientId;
    const clientSecret = hubClientSecret || legacyClientSecret;
    if (!clientId || !clientSecret) return null;

    const parsed = [...context.parsedUrls].reverse().find((item) => item.provider === "naver");
    const query = parsed?.title?.trim();
    if (!parsed || !query) return null;

    const useApiHub = Boolean(hubClientId && hubClientSecret);
    const endpoint = new URL(useApiHub
      ? "https://naverapihub.apigw.ntruss.com/search/v1/local"
      : "https://openapi.naver.com/v1/search/local.json");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("display", "5");
    if (useApiHub) endpoint.searchParams.set("format", "json");

    const response = await context.fetcher(endpoint, {
      headers: useApiHub
        ? {
            "X-NCP-APIGW-API-KEY-ID": clientId,
            "X-NCP-APIGW-API-KEY": clientSecret,
          }
        : {
            "X-Naver-Client-Id": clientId,
            "X-Naver-Client-Secret": clientSecret,
          },
      cache: "no-store",
    });

    if (!response.ok) {
      throw providerError("Naver 지역 검색에 실패했습니다.", response.status);
    }

    const body = await response.json() as { items?: NaverLocalItem[] };
    const item = selectNaverItem(body.items ?? [], parsed.placeId, query, parsed.latitude, parsed.longitude);
    return item ? normalizeNaverItem(item, parsed.placeId) : null;
  },
};

function selectNaverItem(
  items: NaverLocalItem[],
  placeId: string | undefined,
  query: string,
  latitude?: number,
  longitude?: number,
) {
  if (placeId) {
    const idMatch = items.find((item) => text(item.link)?.includes(placeId));
    if (idMatch) return idMatch;
  }

  const normalizedQuery = normalizeName(query);
  const nameMatch = items.find((item) => normalizeName(stripHtml(item.title) ?? "") === normalizedQuery);

  if (nameMatch && (!placeId || isNearCoordinates(nameMatch, latitude, longitude))) {
    return nameMatch;
  }

  if (placeId) {
    return null;
  }

  const nearbyItem = items
    .map((item) => ({ item, distance: coordinateDistanceMeters(item, latitude, longitude) }))
    .filter((candidate): candidate is { item: NaverLocalItem; distance: number } => candidate.distance !== null)
    .sort((a, b) => a.distance - b.distance)[0];

  if (nearbyItem && nearbyItem.distance <= 1500) {
    return nearbyItem.item;
  }

  return items.length === 1 ? items[0] : null;
}

function normalizeNaverItem(item: NaverLocalItem, parsedPlaceId?: string): Partial<NormalizedPlace> {
  const longitude = normalizeNaverCoordinate(item.mapx, "longitude");
  const latitude = normalizeNaverCoordinate(item.mapy, "latitude");
  const coordinates = normalizeCoordinates(latitude, longitude);
  const link = text(item.link);

  return {
    providerPlaceId: parsedPlaceId ?? link?.match(/\/(\d+)(?:$|[/?#])/)?.[1],
    name: stripHtml(item.title),
    category: text(item.category),
    types: text(item.category)?.split(">").map((value) => value.trim()).filter(Boolean),
    description: stripHtml(item.description),
    addressKo: text(item.address),
    roadAddressKo: text(item.roadAddress),
    formattedAddress: text(item.roadAddress) ?? text(item.address),
    ...coordinates,
    phone: text(item.telephone),
    providerUri: link,
    providerWarnings: [
      "photos_not_supported",
      "price_not_supported",
      "opening_hours_not_supported",
      "rating_not_supported",
      "review_count_not_supported",
      "website_not_supported",
    ],
    fetchedAt: new Date().toISOString(),
    raw: item,
  };
}

function normalizeNaverCoordinate(value: unknown, kind: "latitude" | "longitude") {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return undefined;
  const limit = kind === "latitude" ? 90 : 180;
  return Math.abs(number) > limit ? number / 10_000_000 : number;
}

function normalizeName(value: string) {
  return value.replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}

function isNearCoordinates(item: NaverLocalItem, latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) return true;
  const distance = coordinateDistanceMeters(item, latitude, longitude);
  return distance !== null && distance <= 1500;
}

function coordinateDistanceMeters(item: NaverLocalItem, latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) return null;
  const itemCoordinates = normalizeCoordinates(
    normalizeNaverCoordinate(item.mapy, "latitude"),
    normalizeNaverCoordinate(item.mapx, "longitude"),
  );
  if (!itemCoordinates) return null;

  const latitudeDelta = (itemCoordinates.latitude - latitude) * 111_320;
  const longitudeDelta = (itemCoordinates.longitude - longitude) * 111_320 * Math.cos(latitude * Math.PI / 180);
  return Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2);
}

function providerError(message: string, providerStatus: number) {
  return Object.assign(new Error(message), { status: 502, expose: true, providerStatus });
}
