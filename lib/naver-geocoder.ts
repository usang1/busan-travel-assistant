import { naverMapNcpKeyId } from "@/lib/map-provider";

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

type NaverWindow = Window & {
  naver?: {
    maps?: Partial<NaverGeocoderMapsNamespace>;
  };
  __busanTravelAssistantNaverGeocoderReady?: () => void;
};

const callbackName = "__busanTravelAssistantNaverGeocoderReady";
let geocoderPromise: Promise<NaverGeocoderMapsNamespace> | null = null;

export function canUseNaverGeocoder() {
  return Boolean(naverMapNcpKeyId);
}

export async function geocodeKoreanAddress(address: string): Promise<NaverGeocodeResult[]> {
  const query = address.trim();

  if (!query) {
    throw new Error("주소를 먼저 입력해 주세요.");
  }

  const maps = await loadNaverGeocoder();

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

function loadNaverGeocoder(): Promise<NaverGeocoderMapsNamespace> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("브라우저에서만 주소 검색을 사용할 수 있습니다."));
  }

  if (!naverMapNcpKeyId) {
    return Promise.reject(new Error("NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID가 설정되어 있지 않습니다."));
  }

  const existingMaps = getNaverMaps();

  if (hasGeocoder(existingMaps)) {
    return Promise.resolve(existingMaps);
  }

  if (geocoderPromise) {
    return geocoderPromise;
  }

  geocoderPromise = new Promise((resolve, reject) => {
    const finish = () => {
      const maps = getNaverMaps();

      if (hasGeocoder(maps)) {
        resolve(maps);
        return;
      }

      reject(new Error("네이버 지도 Geocoder 모듈을 불러오지 못했습니다."));
    };

    const win = window as NaverWindow;
    win[callbackName] = finish;

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-naver-maps-sdk='true']");

    if (existingScript) {
      existingScript.addEventListener("load", () => window.setTimeout(finish, 0), { once: true });
      window.setTimeout(finish, 250);
      return;
    }

    const script = document.createElement("script");
    const params = new URLSearchParams({
      ncpKeyId: naverMapNcpKeyId,
      submodules: "geocoder",
      callback: callbackName,
    });

    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${params.toString()}`;
    script.async = true;
    script.dataset.naverMapsSdk = "true";
    script.addEventListener("error", () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다.")));
    document.head.appendChild(script);
  });

  return geocoderPromise;
}

function getNaverMaps() {
  return (window as NaverWindow).naver?.maps;
}

function hasGeocoder(maps: Partial<NaverGeocoderMapsNamespace> | undefined): maps is NaverGeocoderMapsNamespace {
  return typeof maps?.Service?.geocode === "function" && typeof maps.Service.Status?.OK === "string";
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
