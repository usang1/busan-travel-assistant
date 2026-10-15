import "server-only";

import { asRecord } from "@/lib/place-providers/normalize";
import { googlePlaceFields, normalizeGooglePlace, resolveGooglePhotos } from "@/lib/place-providers/google";
import { normalizeKakaoItem, type KakaoPlaceDocument } from "@/lib/place-providers/kakao";
import { normalizeNaverItem, type NaverLocalItem } from "@/lib/place-providers/naver";
import type { NormalizedPlace, SupportedPlaceProvider } from "@/lib/place-providers/types";
import { getPlaceProviderConfiguration } from "@/lib/place-providers/registry";
import { isValidCoordinates, type Coordinates } from "@/lib/location";

type ProviderSearchStatus = {
  provider: SupportedPlaceProvider;
  configured: boolean;
  ok: boolean;
  message?: string;
};

export type OfficialPlaceSearchResult = {
  results: NormalizedPlace[];
  providers: ProviderSearchStatus[];
  fetchedAt: string;
  cacheHit: boolean;
};

const searchCache = new Map<string, { expiresAt: number; value: Promise<Omit<OfficialPlaceSearchResult, "cacheHit">> }>();
const searchCacheTtlMs = 5 * 60 * 1000;

export async function searchOfficialPlacesCached(query: string, location?: Coordinates | null): Promise<OfficialPlaceSearchResult> {
  const normalizedQuery = normalizeQuery(query);
  const normalizedLocation = location && isValidCoordinates(location) ? location : null;
  const key = [normalizedQuery.toLowerCase(), normalizedLocation ? normalizedLocation.latitude.toFixed(3) : "", normalizedLocation ? normalizedLocation.longitude.toFixed(3) : ""].join(":");
  const now = Date.now();
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > now) return { ...(await cached.value), cacheHit: true };

  const value = searchOfficialPlaces(normalizedQuery, normalizedLocation);
  searchCache.set(key, { expiresAt: now + searchCacheTtlMs, value });
  try {
    return { ...(await value), cacheHit: false };
  } catch (error) {
    searchCache.delete(key);
    throw error;
  }
}

async function searchOfficialPlaces(query: string, location: Coordinates | null): Promise<Omit<OfficialPlaceSearchResult, "cacheHit">> {
  const providers: SupportedPlaceProvider[] = ["kakao", "google", "naver"];
  const settled = await Promise.all(providers.map(async (provider): Promise<{ status: ProviderSearchStatus; results: NormalizedPlace[] }> => {
    const configuration = getPlaceProviderConfiguration(provider);
    if (!configuration.configured) {
      return { status: { provider, configured: false, ok: false, message: `${configuration.missingEnvironmentVariables.join(", ")} 미설정` }, results: [] };
    }
    try {
      const results = provider === "kakao"
        ? await searchKakao(query, location)
        : provider === "google"
          ? await searchGoogle(query, location)
          : await searchNaver(query);
      return { status: { provider, configured: true, ok: true }, results };
    } catch (error) {
      return {
        status: { provider, configured: true, ok: false, message: error instanceof Error ? error.message : "검색 실패" },
        results: [],
      };
    }
  }));

  return {
    results: settled.flatMap((item) => item.results).slice(0, 12),
    providers: settled.map((item) => item.status),
    fetchedAt: new Date().toISOString(),
  };
}

async function searchKakao(query: string, location: Coordinates | null) {
  const apiKey = process.env.KAKAO_REST_API_KEY!.trim();
  const endpoint = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("size", "5");
  if (location) {
    endpoint.searchParams.set("x", String(location.longitude));
    endpoint.searchParams.set("y", String(location.latitude));
    endpoint.searchParams.set("radius", "20000");
    endpoint.searchParams.set("sort", "distance");
  }
  const response = await timedFetch(endpoint, { headers: { Authorization: `KakaoAK ${apiKey}` }, cache: "no-store" });
  if (!response.ok) throw providerError("Kakao 장소 검색에 실패했습니다.", response.status);
  const body = await response.json() as { documents?: KakaoPlaceDocument[] };
  return (Array.isArray(body.documents) ? body.documents : []).map((item) => ({
    provider: "kakao" as const,
    sourceUrl: String(asRecord(item)?.place_url || ""),
    ...normalizeKakaoItem(item),
  }));
}

async function searchGoogle(query: string, location: Coordinates | null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY!.trim();
  const response = await timedFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": googlePlaceFields.split(",").map((field) => `places.${field}`).join(","),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ko",
      regionCode: "KR",
      pageSize: 5,
      ...(location ? { locationBias: { circle: { center: location, radius: 20_000 } } } : {}),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw providerError("Google Places 검색에 실패했습니다.", response.status);
  const body = asRecord(await response.json());
  const places = Array.isArray(body?.places) ? body.places : [];
  return Promise.all(places.map(async (raw): Promise<NormalizedPlace | null> => {
    const normalized = normalizeGooglePlace(raw);
    if (!normalized) return null;
    const photos = await resolveGooglePhotos(raw, apiKey, timedFetch).catch(() => ({ photos: [], warnings: ["photo_lookup_failed"] }));
    return {
      provider: "google",
      sourceUrl: normalized.providerUri || "",
      ...normalized,
      imageUrl: photos.photos[0]?.url,
      primaryImageUrl: photos.photos[0]?.url,
      photos: photos.photos,
      providerWarnings: photos.warnings,
      fetchedAt: new Date().toISOString(),
    };
  })).then((items) => items.filter((item): item is NormalizedPlace => Boolean(item)));
}

async function searchNaver(query: string) {
  const hubClientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim();
  const hubClientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();
  const clientId = hubClientId || process.env.NAVER_SEARCH_CLIENT_ID?.trim() || "";
  const clientSecret = hubClientSecret || process.env.NAVER_SEARCH_CLIENT_SECRET?.trim() || "";
  const useApiHub = Boolean(hubClientId && hubClientSecret);
  const endpoint = new URL(useApiHub ? "https://naverapihub.apigw.ntruss.com/search/v1/local" : "https://openapi.naver.com/v1/search/local.json");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("display", "5");
  if (useApiHub) endpoint.searchParams.set("format", "json");
  const response = await timedFetch(endpoint, {
    headers: useApiHub
      ? { "X-NCP-APIGW-API-KEY-ID": clientId, "X-NCP-APIGW-API-KEY": clientSecret }
      : { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    cache: "no-store",
  });
  if (!response.ok) throw providerError("Naver 지역 검색에 실패했습니다.", response.status);
  const body = await response.json() as { items?: NaverLocalItem[] };
  return (Array.isArray(body.items) ? body.items : []).map((item) => {
    const normalized = normalizeNaverItem(item);
    return {
      provider: "naver" as const,
      sourceUrl: normalized.providerUri || "",
      ...normalized,
    };
  });
}

async function timedFetch(input: URL | string | Request, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeQuery(value: string) {
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 120) throw Object.assign(new Error("가게명·주소·전화번호를 2~120자로 입력해 주세요."), { status: 400, expose: true });
  return query;
}

function providerError(message: string, providerStatus: number) {
  return Object.assign(new Error(message), { status: 502, expose: true, providerStatus });
}
