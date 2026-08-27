export type MapProvider = "NAVER" | "KAKAO" | "GOOGLE" | "MANUAL";

export type ParsedMapUrl = {
  provider: MapProvider;
  normalizedUrl: string;
};

export function parseMapUrl(value: string): ParsedMapUrl {
  const trimmed = value.trim();

  if (!trimmed) {
    return { provider: "MANUAL", normalizedUrl: "" };
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (host.includes("naver.com") || host.includes("naver.me")) {
      return { provider: "NAVER", normalizedUrl: url.toString() };
    }

    if (host.includes("kakao.com") || host.includes("kakao.link")) {
      return { provider: "KAKAO", normalizedUrl: url.toString() };
    }

    if (host.includes("google.com") || host.includes("goo.gl") || host.includes("maps.app.goo.gl")) {
      return { provider: "GOOGLE", normalizedUrl: url.toString() };
    }
  } catch {
    return { provider: "MANUAL", normalizedUrl: trimmed };
  }

  return { provider: "MANUAL", normalizedUrl: trimmed };
}
