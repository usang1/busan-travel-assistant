"use client";

type NaverMapsWindow = Window & {
  naver?: {
    maps?: unknown;
  };
};

const sdkSelector = "script[data-naver-maps-sdk='true']";
const sdkTimeoutMs = 12_000;
let sdkPromise: Promise<unknown> | null = null;

export function loadNaverMapsSdk<MapsNamespace>(ncpKeyId: string): Promise<MapsNamespace> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("네이버 지도는 브라우저에서만 불러올 수 있습니다."));
  }

  const key = ncpKeyId.trim();

  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID가 설정되어 있지 않습니다."));
  }

  const readyMaps = getReadyMaps();

  if (readyMaps) {
    return Promise.resolve(readyMaps as MapsNamespace);
  }

  if (!sdkPromise) {
    sdkPromise = createSdkPromise(key).catch((error) => {
      // A transient SDK or network failure must not poison every later retry.
      sdkPromise = null;
      throw error;
    });
  }

  return sdkPromise as Promise<MapsNamespace>;
}

function createSdkPromise(ncpKeyId: string) {
  return new Promise<unknown>((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let timeoutTimer: number | null = null;
    let script = document.querySelector<HTMLScriptElement>(sdkSelector);

    if (script?.dataset.naverMapsFailed === "true") {
      script.remove();
      script = null;
    }

    const cleanup = () => {
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
      script?.removeEventListener("load", checkReady);
      script?.removeEventListener("error", failFromScript);
    };

    const succeed = (maps: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(maps);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      if (script) script.dataset.naverMapsFailed = "true";
      cleanup();
      reject(new Error(message));
    };

    function checkReady() {
      const maps = getReadyMaps();
      if (maps) succeed(maps);
    }

    function failFromScript() {
      fail("네이버 지도 SDK를 불러오지 못했습니다. API 키와 허용 도메인을 확인해 주세요.");
    }

    if (!script) {
      script = document.createElement("script");
      const params = new URLSearchParams({
        ncpKeyId,
        submodules: "geocoder",
      });
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?${params.toString()}`;
      script.async = true;
      script.dataset.naverMapsSdk = "true";
      document.head.appendChild(script);
    }

    script.addEventListener("load", checkReady);
    script.addEventListener("error", failFromScript, { once: true });

    // An existing script may have fired its load event before this consumer mounted.
    // Polling the namespace covers that race and the brief geocoder submodule delay.
    checkReady();
    pollTimer = window.setInterval(checkReady, 50);
    timeoutTimer = window.setTimeout(() => {
      fail("네이버 지도 SDK 응답 시간이 초과되었습니다. 네트워크와 허용 도메인을 확인해 주세요.");
    }, sdkTimeoutMs);
  });
}

function getReadyMaps() {
  const maps = (window as NaverMapsWindow).naver?.maps;
  const candidate = asRecord(maps);
  const service = asRecord(candidate?.Service);

  if (
    typeof candidate?.Map === "function"
    && typeof candidate?.LatLng === "function"
    && typeof service?.geocode === "function"
  ) {
    return maps;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}
