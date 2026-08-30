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

  const coordinates = coordinatesFromUrl(url);

  if (coordinates) {
    result.latitude = coordinates.latitude;
    result.longitude = coordinates.longitude;
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

function coordinatesFromUrl(url: URL) {
  const directLat = numberParam(url, ["lat", "latitude", "y"]);
  const directLng = numberParam(url, ["lng", "lon", "longitude", "x"]);

  if (directLat !== null && directLng !== null) {
    return normalizeCoordinatePair(directLat, directLng);
  }

  for (const name of ["query", "q", "ll", "center", "destination", "daddr", "saddr"]) {
    const pair = coordinatesFromText(url.searchParams.get(name) ?? "");

    if (pair) {
      return pair;
    }
  }

  const naverCenter = coordinatesFromText(url.searchParams.get("c") ?? "", "lngLat");

  if (naverCenter) {
    return naverCenter;
  }

  return coordinatesFromText(decodeURIComponent(url.toString()));
}

function coordinatesFromText(value: string, preferredOrder: "auto" | "latLng" | "lngLat" = "auto") {
  const text = value.trim();

  if (!text) {
    return null;
  }

  const bangPair = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangPair) {
    return normalizeCoordinatePair(Number(bangPair[1]), Number(bangPair[2]), "latLng");
  }

  const atPair = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atPair) {
    return normalizeCoordinatePair(Number(atPair[1]), Number(atPair[2]), "latLng");
  }

  const plainPair = text.match(/(?:^|[=:/?&,\s])(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:$|[,&/\s])/);
  if (plainPair) {
    return normalizeCoordinatePair(Number(plainPair[1]), Number(plainPair[2]), preferredOrder);
  }

  return null;
}

function normalizeCoordinatePair(first: number, second: number, preferredOrder: "auto" | "latLng" | "lngLat" = "auto") {
  if (preferredOrder === "lngLat") {
    return validCoordinates(second, first) ? { latitude: second, longitude: first } : null;
  }

  if (preferredOrder === "latLng") {
    return validCoordinates(first, second) ? { latitude: first, longitude: second } : null;
  }

  if (validCoordinates(first, second) && Math.abs(first) <= 90 && Math.abs(second) > 90) {
    return { latitude: first, longitude: second };
  }

  if (validCoordinates(second, first) && Math.abs(first) > 90 && Math.abs(second) <= 90) {
    return { latitude: second, longitude: first };
  }

  return validCoordinates(first, second) ? { latitude: first, longitude: second } : null;
}

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
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
