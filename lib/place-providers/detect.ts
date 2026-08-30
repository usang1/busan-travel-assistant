import type { DetectedPlaceProvider } from "@/lib/place-providers/types";

const naverHosts = ["map.naver.com", "place.naver.com", "m.place.naver.com", "naver.me"];
const kakaoHosts = ["map.kakao.com", "place.map.kakao.com", "m.map.kakao.com", "kko.kakao.com"];
const googleShortHosts = ["maps.app.goo.gl", "goo.gl"];

export function detectPlaceProvider(value: string | URL): DetectedPlaceProvider {
  const url = toUrl(value);

  if (!url) {
    return "unknown";
  }

  const host = url.hostname.toLowerCase();

  if (naverHosts.includes(host)) {
    return "naver";
  }

  if (kakaoHosts.includes(host)) {
    return "kakao";
  }

  if (googleShortHosts.includes(host)) {
    return host === "goo.gl" && !url.pathname.startsWith("/maps") ? "unknown" : "google";
  }

  if (isGoogleHost(host) && (host.startsWith("maps.") || url.pathname.startsWith("/maps"))) {
    return "google";
  }

  return "unknown";
}

export function isSupportedPlaceUrl(value: string | URL) {
  return detectPlaceProvider(value) !== "unknown";
}

export function isAllowedPlaceHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    naverHosts.includes(host) ||
    kakaoHosts.includes(host) ||
    googleShortHosts.includes(host) ||
    isGoogleHost(host)
  );
}

function isGoogleHost(host: string) {
  return host === "google.com" || host.endsWith(".google.com") || host === "google.co.kr" || host.endsWith(".google.co.kr");
}

function toUrl(value: string | URL) {
  if (value instanceof URL) {
    return value;
  }

  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}
