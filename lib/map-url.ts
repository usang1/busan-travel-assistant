import type { PlaceSourceProvider } from "@/types/database";
import { detectPlaceProvider, isAllowedPlaceHost } from "@/lib/place-providers/detect";
import type { DetectedPlaceProvider } from "@/lib/place-providers/types";

export type MapProvider = DetectedPlaceProvider;
export type CoordinateConfidence = "high" | "medium" | "low" | "none";
export type CoordinateSource =
  | "query"
  | "naver-center"
  | "google-at-path"
  | "google-data"
  | "kakao-link"
  | "provider-lookup"
  | "text"
  | "none";

export type ParsedMapUrl = {
  provider: MapProvider;
  sourceProvider: PlaceSourceProvider;
  normalizedUrl: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  coordinateSource: CoordinateSource;
  confidence: CoordinateConfidence;
  failureReason?: string;
  title?: string;
};

type CoordinateMatch = {
  latitude: number;
  longitude: number;
  source: CoordinateSource;
  confidence: Exclude<CoordinateConfidence, "none">;
};

type CoordinateOrder = "auto" | "latLng" | "lngLat";

export function parseMapUrl(value: string): ParsedMapUrl {
  const normalizedUrl = normalizeMapUrl(value);

  if (!normalizedUrl) {
    return emptyParsedMapUrl("");
  }

  let url: URL;

  try {
    url = new URL(normalizedUrl);
  } catch {
    return {
      ...emptyParsedMapUrl(normalizedUrl),
      failureReason: "invalid_url",
    };
  }

  const provider = detectPlaceProvider(url);
  const placeId = extractPlaceId(url, provider);
  const coordinates = provider === "unknown" ? null : extractCoordinates(url, provider);
  const title = extractTitle(url, coordinates);

  return {
    provider,
    sourceProvider: toPlaceSourceProvider(provider),
    normalizedUrl: url.toString(),
    placeId: placeId ?? undefined,
    title: title || undefined,
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    coordinateSource: coordinates?.source ?? "none",
    confidence: coordinates?.confidence ?? (placeId ? "medium" : provider === "unknown" ? "none" : "low"),
    failureReason: coordinates ? undefined : provider === "unknown" ? "unsupported_domain" : "no_coordinates",
  };
}

export function normalizeMapUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return trimmed;
    }
  }
}

export function detectMapProvider(hostname: string): MapProvider {
  return detectPlaceProvider(`https://${hostname}/maps`);
}

export function toPlaceSourceProvider(provider: MapProvider): PlaceSourceProvider {
  if (provider === "naver") return "NAVER";
  if (provider === "kakao") return "KAKAO";
  if (provider === "google") return "GOOGLE";
  return "MANUAL";
}

export function normalizeLatitude(value: unknown) {
  const number = normalizeNumber(value);
  return number !== null && number >= -90 && number <= 90 ? number : null;
}

export function normalizeLongitude(value: unknown) {
  const number = normalizeNumber(value);
  return number !== null && number >= -180 && number <= 180 ? number : null;
}

export function isResolvableMapHost(hostname: string) {
  return isAllowedPlaceHost(hostname);
}

function emptyParsedMapUrl(normalizedUrl: string): ParsedMapUrl {
  return {
    provider: "unknown",
    sourceProvider: "MANUAL",
    normalizedUrl,
    coordinateSource: "none",
    confidence: "none",
    failureReason: normalizedUrl ? "unsupported_domain" : "empty_url",
  };
}

function extractCoordinates(url: URL, provider: MapProvider): CoordinateMatch | null {
  const direct = coordinatesFromDirectParams(url, provider);

  if (direct) {
    return direct;
  }

  const providerSpecific =
    provider === "naver"
      ? coordinatesFromNaver(url)
      : provider === "kakao"
        ? coordinatesFromKakao(url)
        : provider === "google"
          ? coordinatesFromGoogle(url)
          : null;

  if (providerSpecific) {
    return providerSpecific;
  }

  return coordinatesFromText(decodeURIComponent(url.toString()), "auto", "text");
}

function coordinatesFromDirectParams(url: URL, provider: MapProvider): CoordinateMatch | null {
  const directLat = numberParam(url, ["lat", "latitude"]);
  const directLng = numberParam(url, ["lng", "lon", "longitude"]);

  if (directLat !== null && directLng !== null) {
    return normalizeCoordinatePair(directLat, directLng, "latLng", "query", "high");
  }

  const x = numberParam(url, ["x"]);
  const y = numberParam(url, ["y"]);

  if (x !== null && y !== null) {
    return normalizeCoordinatePair(x, y, provider === "kakao" || provider === "naver" ? "lngLat" : "auto", "query", "medium");
  }

  for (const name of ["query", "q", "ll", "center", "destination", "daddr", "saddr"]) {
    const pair = coordinatesFromText(url.searchParams.get(name) ?? "", "auto", "query");

    if (pair) {
      return pair;
    }
  }

  return null;
}

function coordinatesFromNaver(url: URL): CoordinateMatch | null {
  const center = coordinatesFromText(url.searchParams.get("c") ?? "", "lngLat", "naver-center");

  if (center) {
    return center;
  }

  return coordinatesFromText(url.pathname, "auto", "text");
}

function coordinatesFromKakao(url: URL): CoordinateMatch | null {
  const linkMatch = url.pathname.match(/\/link\/(?:map|to)\/[^/]*?,(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:$|[/?#])/);

  if (linkMatch) {
    return normalizeCoordinatePair(Number(linkMatch[1]), Number(linkMatch[2]), "latLng", "kakao-link", "high");
  }

  return coordinatesFromText(url.pathname, "auto", "text");
}

function coordinatesFromGoogle(url: URL): CoordinateMatch | null {
  const dataPair = coordinatesFromText(url.pathname + url.search + url.hash, "latLng", "google-data");

  if (dataPair) {
    return dataPair;
  }

  return null;
}

function coordinatesFromText(
  value: string,
  preferredOrder: CoordinateOrder = "auto",
  source: CoordinateSource = "text",
): CoordinateMatch | null {
  const text = value.trim();

  if (!text) {
    return null;
  }

  const atPair = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atPair) {
    return normalizeCoordinatePair(Number(atPair[1]), Number(atPair[2]), "latLng", "google-at-path", "high");
  }

  const bangPair = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangPair) {
    return normalizeCoordinatePair(Number(bangPair[1]), Number(bangPair[2]), "latLng", "google-data", "high");
  }

  const plainPair = text.match(/(?:^|[=:/?&,\s])(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:$|[,&)/\s])/);
  if (plainPair) {
    return normalizeCoordinatePair(Number(plainPair[1]), Number(plainPair[2]), preferredOrder, source, source === "text" ? "medium" : "high");
  }

  return null;
}

function normalizeCoordinatePair(
  first: number,
  second: number,
  preferredOrder: CoordinateOrder,
  source: CoordinateSource,
  confidence: Exclude<CoordinateConfidence, "none">,
): CoordinateMatch | null {
  if (preferredOrder === "lngLat") {
    return validCoordinates(second, first) ? { latitude: second, longitude: first, source, confidence } : null;
  }

  if (preferredOrder === "latLng") {
    return validCoordinates(first, second) ? { latitude: first, longitude: second, source, confidence } : null;
  }

  const latLngValid = validCoordinates(first, second);
  const lngLatValid = validCoordinates(second, first);
  const latLngKorea = latLngValid && isKoreaCoordinate(first, second);
  const lngLatKorea = lngLatValid && isKoreaCoordinate(second, first);

  if (lngLatKorea && !latLngKorea) {
    return { latitude: second, longitude: first, source, confidence };
  }

  if (latLngKorea) {
    return { latitude: first, longitude: second, source, confidence };
  }

  if (latLngValid && Math.abs(first) <= 90 && Math.abs(second) > 90) {
    return { latitude: first, longitude: second, source, confidence };
  }

  if (lngLatValid && Math.abs(first) > 90 && Math.abs(second) <= 90) {
    return { latitude: second, longitude: first, source, confidence };
  }

  return latLngValid ? { latitude: first, longitude: second, source, confidence: "low" } : null;
}

function validCoordinates(latitude: number, longitude: number) {
  return (
    normalizeLatitude(latitude) !== null &&
    normalizeLongitude(longitude) !== null &&
    !(latitude === 0 && longitude === 0)
  );
}

function isKoreaCoordinate(latitude: number, longitude: number) {
  return latitude >= 33 && latitude <= 39 && longitude >= 124 && longitude <= 132;
}

function numberParam(url: URL, names: string[]) {
  for (const name of names) {
    const number = normalizeNumber(url.searchParams.get(name));

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractTitle(url: URL, coordinates: CoordinateMatch | null) {
  const value = textParam(url, ["title", "name", "placeName"]);

  if (value) {
    return value;
  }

  const query = textParam(url, ["query", "q"]);

  if (query && !coordinatesFromText(query)) {
    return query;
  }

  if (url.pathname.includes("/place/")) {
    const pathTitle = decodeURIComponent(url.pathname.split("/place/")[1]?.split("/")[0] ?? "").replaceAll("+", " ");
    return /^\d+$/.test(pathTitle) ? "" : pathTitle;
  }

  if (url.hostname.endsWith("naver.com")) {
    const searchTitle = decodePathSegment(url.pathname.match(/\/p\/search\/([^/]+)/)?.[1]);
    if (searchTitle) return searchTitle;
  }

  if (url.hostname.endsWith("kakao.com")) {
    const linkTitle = decodePathSegment(url.pathname.match(/\/link\/(?:map|to)\/([^,/?#]+)/)?.[1]);
    if (linkTitle) return linkTitle;
  }

  return "";
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

function extractPlaceId(url: URL, provider: MapProvider) {
  if (provider === "naver") {
    return (
      url.searchParams.get("pinId") ??
      url.searchParams.get("placeId") ??
      url.pathname.match(/\/(?:entry\/place|place|restaurant|cafe)\/(\d+)/)?.[1] ??
      null
    );
  }

  if (provider === "kakao") {
    return url.pathname.match(/\/(\d+)(?:$|[/?#])/)?.[1] ?? url.searchParams.get("itemId") ?? url.searchParams.get("placeId");
  }

  if (provider === "google") {
    return (
      url.searchParams.get("query_place_id") ??
      url.searchParams.get("place_id") ??
      extractGooglePlaceIdFromData(url) ??
      url.searchParams.get("cid") ??
      url.searchParams.get("ftid")
    );
  }

  return null;
}

function extractGooglePlaceIdFromData(url: URL) {
  const decoded = decodeURIComponent(`${url.pathname}${url.search}${url.hash}`);
  return decoded.match(/!1s(ChI[A-Za-z0-9_-]+)/)?.[1] ?? decoded.match(/(?:place_id:|place\/)(ChI[A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function decodePathSegment(value?: string) {
  if (!value) return "";

  try {
    return decodeURIComponent(value).replaceAll("+", " ").trim();
  } catch {
    return value.replaceAll("+", " ").trim();
  }
}
