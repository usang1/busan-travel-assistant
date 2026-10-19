import "server-only";

import { isValidCoordinates, type Coordinates } from "@/lib/location";

export type GeocodedAddress = Coordinates & {
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
  provider: "naver" | "kakao";
  fetchedAt: string;
};

export async function geocodeAddressOnServer(query: string): Promise<GeocodedAddress[]> {
  const address = query.trim();
  if (address.length < 2 || address.length > 200) throw publicError("주소를 2~200자로 입력해 주세요.", 400);

  const providers = configuredProviders();
  if (!providers.length) throw missingProviderError();

  const failures: Error[] = [];
  for (const provider of providers) {
    try {
      const results = provider === "naver"
        ? await geocodeWithNaver(address)
        : await geocodeWithKakao(address);
      if (results.length) return results;
    } catch (error) {
      failures.push(toError(error));
    }
  }

  if (failures.length === providers.length) throw combinedProviderError(failures);
  return [];
}

export async function reverseGeocodeOnServer(coordinates: Coordinates): Promise<GeocodedAddress | null> {
  if (!isValidCoordinates(coordinates)) throw publicError("유효한 위도와 경도를 입력해 주세요.", 400);

  const providers = configuredProviders();
  if (!providers.length) throw missingProviderError();

  const failures: Error[] = [];
  for (const provider of providers) {
    try {
      const result = provider === "naver"
        ? await reverseGeocodeWithNaver(coordinates)
        : await reverseGeocodeWithKakao(coordinates);
      if (result) return result;
    } catch (error) {
      failures.push(toError(error));
    }
  }

  if (failures.length === providers.length) throw combinedProviderError(failures);
  return null;
}

async function geocodeWithKakao(address: string) {
  const endpoint = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  endpoint.searchParams.set("query", address);
  endpoint.searchParams.set("analyze_type", "similar");
  endpoint.searchParams.set("size", "5");

  const body = await fetchKakao(endpoint) as { documents?: unknown[] };
  return (Array.isArray(body.documents) ? body.documents : [])
    .map(normalizeAddressDocument)
    .filter((item): item is GeocodedAddress => Boolean(item));
}

async function reverseGeocodeWithKakao(coordinates: Coordinates): Promise<GeocodedAddress | null> {
  const endpoint = new URL("https://dapi.kakao.com/v2/local/geo/coord2address.json");
  endpoint.searchParams.set("x", String(coordinates.longitude));
  endpoint.searchParams.set("y", String(coordinates.latitude));
  endpoint.searchParams.set("input_coord", "WGS84");

  const body = await fetchKakao(endpoint) as { documents?: unknown[] };
  const document = Array.isArray(body.documents) ? asRecord(body.documents[0]) : null;
  if (!document) return null;
  const road = asRecord(document.road_address);
  const jibun = asRecord(document.address);
  const roadAddress = stringValue(road?.address_name);
  const jibunAddress = stringValue(jibun?.address_name);

  return {
    ...coordinates,
    address: roadAddress || jibunAddress || "선택한 위치",
    roadAddress: roadAddress || undefined,
    jibunAddress: jibunAddress || undefined,
    provider: "kakao",
    fetchedAt: new Date().toISOString(),
  };
}

async function geocodeWithNaver(address: string): Promise<GeocodedAddress[]> {
  const endpoint = new URL("https://maps.apigw.ntruss.com/map-geocode/v2/geocode");
  endpoint.searchParams.set("query", address);
  endpoint.searchParams.set("count", "5");
  const body = await fetchNaver(endpoint) as { addresses?: unknown[] };
  return (Array.isArray(body.addresses) ? body.addresses : [])
    .map(normalizeNaverAddress)
    .filter((item): item is GeocodedAddress => Boolean(item));
}

async function reverseGeocodeWithNaver(coordinates: Coordinates): Promise<GeocodedAddress | null> {
  const endpoint = new URL("https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc");
  endpoint.searchParams.set("coords", `${coordinates.longitude},${coordinates.latitude}`);
  endpoint.searchParams.set("sourcecrs", "epsg:4326");
  endpoint.searchParams.set("orders", "roadaddr,addr");
  endpoint.searchParams.set("output", "json");
  const body = await fetchNaver(endpoint) as { results?: unknown[] };
  const results = Array.isArray(body.results) ? body.results.map(asRecord).filter(Boolean) : [];
  const road = results.find((item) => stringValue(item?.name) === "roadaddr") ?? null;
  const jibun = results.find((item) => stringValue(item?.name) === "addr") ?? null;
  if (!road && !jibun) return null;

  const roadAddress = formatNaverReverseAddress(road);
  const jibunAddress = formatNaverReverseAddress(jibun);
  return {
    ...coordinates,
    address: roadAddress || jibunAddress || "선택한 위치",
    roadAddress: roadAddress || undefined,
    jibunAddress: jibunAddress || undefined,
    provider: "naver",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchNaver(endpoint: URL) {
  const credentials = naverCredentials();
  if (!credentials) throw publicError("Naver Maps 서버 인증 정보가 설정되어 있지 않습니다.", 503);
  return fetchJson(endpoint, {
    "x-ncp-apigw-api-key-id": credentials.keyId,
    "x-ncp-apigw-api-key": credentials.apiKey,
    Accept: "application/json",
  }, "Naver");
}

async function fetchKakao(endpoint: URL) {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) throw publicError("KAKAO_REST_API_KEY가 설정되어 있지 않아 주소 변환을 사용할 수 없습니다.", 503);

  return fetchJson(endpoint, { Authorization: `KakaoAK ${apiKey}` }, "Kakao");
}

async function fetchJson(endpoint: URL, headers: Record<string, string>, provider: "Naver" | "Kakao") {

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw publicError(
        response.status === 401 || response.status === 403
          ? `${provider} 주소 API 인증에 실패했습니다. API 키와 Geocoding 사용 설정을 확인해 주세요.`
          : response.status === 429
            ? "주소 검색 요청이 많습니다. 잠시 후 다시 시도해 주세요."
            : "주소 검색 제공자의 응답을 받을 수 없습니다.",
        response.status === 429 ? 429 : 502,
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw publicError("주소 검색 응답 시간이 초과되었습니다.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeNaverAddress(value: unknown): GeocodedAddress | null {
  const record = asRecord(value);
  if (!record) return null;
  const coordinates = { latitude: Number(record.y), longitude: Number(record.x) };
  if (!isValidCoordinates(coordinates)) return null;
  const roadAddress = stringValue(record.roadAddress);
  const jibunAddress = stringValue(record.jibunAddress);
  return {
    ...coordinates,
    address: roadAddress || jibunAddress || stringValue(record.englishAddress) || "주소 결과",
    roadAddress: roadAddress || undefined,
    jibunAddress: jibunAddress || undefined,
    provider: "naver",
    fetchedAt: new Date().toISOString(),
  };
}

function formatNaverReverseAddress(value: Record<string, unknown> | null) {
  if (!value) return "";
  const region = asRecord(value.region);
  const land = asRecord(value.land);
  const parts = ["area1", "area2", "area3", "area4"]
    .map((key) => stringValue(asRecord(region?.[key])?.name))
    .filter(Boolean);
  const landName = stringValue(land?.name);
  const number1 = stringValue(land?.number1);
  const number2 = stringValue(land?.number2);
  const building = stringValue(asRecord(land?.addition0)?.value);
  if (landName) parts.push(landName);
  if (number1) parts.push(number2 ? `${number1}-${number2}` : number1);
  if (building) parts.push(building);
  return parts.join(" ");
}

function naverCredentials() {
  const keyId = process.env.NAVER_MAPS_API_KEY_ID?.trim()
    || process.env.NAVER_MAPS_CLIENT_ID?.trim()
    || process.env.NAVER_API_HUB_CLIENT_ID?.trim()
    || process.env.NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID?.trim();
  const apiKey = process.env.NAVER_MAPS_API_KEY?.trim()
    || process.env.NAVER_MAPS_CLIENT_SECRET?.trim()
    || process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();
  return keyId && apiKey ? { keyId, apiKey } : null;
}

function configuredProviders(): Array<"naver" | "kakao"> {
  return [naverCredentials() ? "naver" : null, process.env.KAKAO_REST_API_KEY?.trim() ? "kakao" : null]
    .filter((provider): provider is "naver" | "kakao" => Boolean(provider));
}

function missingProviderError() {
  return publicError(
    "주소 좌표 변환 API가 설정되어 있지 않습니다. Naver Maps Geocoding을 활성화하고 서버 API Key를 설정하거나 KAKAO_REST_API_KEY를 설정해 주세요.",
    503,
  );
}

function combinedProviderError(failures: Error[]) {
  return publicError(failures.map((error) => error.message).join(" · "), 502);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error("주소 변환 제공자에서 알 수 없는 오류가 발생했습니다.");
}

function normalizeAddressDocument(value: unknown): GeocodedAddress | null {
  const document = asRecord(value);
  if (!document) return null;
  const latitude = Number(document.y);
  const longitude = Number(document.x);
  const coordinates = { latitude, longitude };
  if (!isValidCoordinates(coordinates)) return null;

  const road = asRecord(document.road_address);
  const jibun = asRecord(document.address);
  const roadAddress = stringValue(road?.address_name);
  const jibunAddress = stringValue(jibun?.address_name);

  return {
    ...coordinates,
    address: roadAddress || jibunAddress || stringValue(document.address_name) || "주소 결과",
    roadAddress: roadAddress || undefined,
    jibunAddress: jibunAddress || undefined,
    provider: "kakao",
    fetchedAt: new Date().toISOString(),
  };
}

function publicError(message: string, status: number) {
  return Object.assign(new Error(message), { status, expose: true });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
