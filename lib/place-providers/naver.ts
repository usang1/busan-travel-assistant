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
    const clientId = process.env.NAVER_SEARCH_CLIENT_ID?.trim();
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) return null;

    const parsed = [...context.parsedUrls].reverse().find((item) => item.provider === "naver");
    const query = parsed?.title?.trim();
    if (!parsed || !query) return null;

    const endpoint = new URL("https://openapi.naver.com/v1/search/local.json");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("display", "5");

    const response = await context.fetcher(endpoint, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw providerError("Naver 지역 검색에 실패했습니다.", response.status);
    }

    const body = await response.json() as { items?: NaverLocalItem[] };
    const item = selectNaverItem(body.items ?? [], parsed.placeId, query);
    return item ? normalizeNaverItem(item, parsed.placeId) : null;
  },
};

function selectNaverItem(items: NaverLocalItem[], placeId: string | undefined, query: string) {
  if (placeId) {
    const idMatch = items.find((item) => text(item.link)?.includes(placeId));
    if (idMatch) return idMatch;
  }

  const normalizedQuery = normalizeName(query);
  return items.find((item) => normalizeName(stripHtml(item.title) ?? "") === normalizedQuery) ?? items[0];
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
    addressKo: text(item.address),
    roadAddressKo: text(item.roadAddress),
    formattedAddress: text(item.roadAddress) ?? text(item.address),
    ...coordinates,
    phone: text(item.telephone),
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
  return value.replace(/\s+/g, "").toLowerCase();
}

function providerError(message: string, providerStatus: number) {
  return Object.assign(new Error(message), { status: 502, expose: true, providerStatus });
}
