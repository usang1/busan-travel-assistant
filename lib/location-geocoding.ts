import "server-only";

import { isValidCoordinates, type Coordinates } from "@/lib/location";

export type GeocodedAddress = Coordinates & {
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
  provider: "kakao";
  fetchedAt: string;
};

export async function geocodeAddressOnServer(query: string): Promise<GeocodedAddress[]> {
  const address = query.trim();
  if (address.length < 2 || address.length > 200) throw publicError("주소를 2~200자로 입력해 주세요.", 400);

  const endpoint = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  endpoint.searchParams.set("query", address);
  endpoint.searchParams.set("analyze_type", "similar");
  endpoint.searchParams.set("size", "5");

  const body = await fetchKakao(endpoint) as { documents?: unknown[] };
  return (Array.isArray(body.documents) ? body.documents : [])
    .map(normalizeAddressDocument)
    .filter((item): item is GeocodedAddress => Boolean(item));
}

export async function reverseGeocodeOnServer(coordinates: Coordinates): Promise<GeocodedAddress | null> {
  if (!isValidCoordinates(coordinates)) throw publicError("유효한 위도와 경도를 입력해 주세요.", 400);

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

async function fetchKakao(endpoint: URL) {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) throw publicError("KAKAO_REST_API_KEY가 설정되어 있지 않아 주소 변환을 사용할 수 없습니다.", 503);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw publicError(
        response.status === 401 || response.status === 403
          ? "주소 API 인증에 실패했습니다. Kakao REST API 키와 허용 설정을 확인해 주세요."
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
