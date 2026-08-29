import { parseMapUrl, type MapProvider } from "@/lib/map-url";

export type MapLinkAnalysisResult = {
  provider: MapProvider;
  normalizedUrl: string;
  resolvedUrl?: string;
  title?: string;
  latitude?: number;
  longitude?: number;
  externalId?: string;
};

export function analyzeMapLink(input: string, resolvedUrls: string[] = []): MapLinkAnalysisResult {
  const parsed = parseMapUrl(input);
  const urls = [parsed.normalizedUrl, ...resolvedUrls].filter(Boolean);
  const result: MapLinkAnalysisResult = {
    provider: parsed.provider,
    normalizedUrl: parsed.normalizedUrl,
    resolvedUrl: resolvedUrls.at(-1),
  };

  for (const urlValue of urls) {
    applyUrlFacts(result, urlValue);
  }

  return result;
}

function applyUrlFacts(result: MapLinkAnalysisResult, urlValue: string) {
  let url: URL;

  try {
    url = new URL(urlValue);
  } catch {
    return;
  }

  const provider = parseMapUrl(url.toString()).provider;
  if (provider !== "MANUAL") {
    result.provider = provider;
  }

  const lat = numberParam(url, ["lat", "y"]);
  const lng = numberParam(url, ["lng", "lon", "x"]);

  if (lat !== null && lng !== null) {
    result.latitude = lat;
    result.longitude = lng;
  }

  const title = textParam(url, ["title", "name", "placeName", "query"]);
  if (title) {
    result.title = title;
  }

  const pinId = textParam(url, ["pinId", "placeId"]);
  if (pinId) {
    result.externalId = pinId;
  }

  const naverPlaceId = url.pathname.match(/\/(?:entry\/place|place)\/(\d+)/)?.[1];
  if (naverPlaceId) {
    result.externalId = naverPlaceId;
  }
}

function numberParam(url: URL, names: string[]) {
  for (const name of names) {
    const value = url.searchParams.get(name);
    const number = value ? Number(value) : Number.NaN;

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function textParam(url: URL, names: string[]) {
  for (const name of names) {
    const value = url.searchParams.get(name)?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}
