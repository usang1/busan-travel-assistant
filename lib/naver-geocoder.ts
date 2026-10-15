import { naverMapNcpKeyId } from "@/lib/map-provider";
import { loadNaverMapsSdk } from "@/lib/naver-maps-sdk";

export type NaverGeocodeResult = {
  latitude: number;
  longitude: number;
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
};

type NaverGeocoderMapsNamespace = {
  Service: {
    Status: {
      OK: string;
    };
    geocode: (
      options: {
        address: string;
        query?: string;
      },
      callback: (status: string, response: unknown) => void,
    ) => void;
  };
};

export function canUseNaverGeocoder() {
  return Boolean(naverMapNcpKeyId);
}

export async function geocodeKoreanAddress(address: string): Promise<NaverGeocodeResult[]> {
  const query = address.trim();

  if (!query) {
    throw new Error("주소를 먼저 입력해 주세요.");
  }

  const maps = await loadNaverMapsSdk<NaverGeocoderMapsNamespace>(naverMapNcpKeyId);

  return new Promise((resolve, reject) => {
    maps.Service.geocode({ address: query, query }, (status, response) => {
      if (status !== maps.Service.Status.OK && status !== "OK") {
        reject(new Error("네이버 주소 검색에 실패했습니다."));
        return;
      }

      const results = parseGeocodeResponse(response);

      if (results.length === 0) {
        reject(new Error("주소 검색 결과가 없습니다. 도로명 주소나 지번 주소로 다시 검색해 주세요."));
        return;
      }

      resolve(results);
    });
  });
}

function parseGeocodeResponse(response: unknown): NaverGeocodeResult[] {
  const root = asRecord(response);
  const v2 = asRecord(root?.v2);
  const v2Addresses = Array.isArray(v2?.addresses) ? v2.addresses : [];

  if (v2Addresses.length) {
    return v2Addresses.map(parseV2Address).filter((result): result is NaverGeocodeResult => Boolean(result));
  }

  const result = asRecord(root?.result);
  const items = Array.isArray(result?.items) ? result.items : [];

  return items.map(parseLegacyItem).filter((item): item is NaverGeocodeResult => Boolean(item));
}

function parseV2Address(item: unknown): NaverGeocodeResult | null {
  const record = asRecord(item);
  const latitude = toNumber(record?.y);
  const longitude = toNumber(record?.x);

  if (latitude === null || longitude === null) {
    return null;
  }

  const roadAddress = toStringValue(record?.roadAddress);
  const jibunAddress = toStringValue(record?.jibunAddress);

  return {
    latitude,
    longitude,
    address: roadAddress || jibunAddress || toStringValue(record?.englishAddress) || "주소 결과",
    roadAddress: roadAddress || undefined,
    jibunAddress: jibunAddress || undefined,
  };
}

function parseLegacyItem(item: unknown): NaverGeocodeResult | null {
  const record = asRecord(item);
  const point = asRecord(record?.point);
  const latitude = toNumber(point?.y);
  const longitude = toNumber(point?.x);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    address: toStringValue(record?.address) || "주소 결과",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
