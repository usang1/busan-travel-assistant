import { parseMapUrl, type CoordinateConfidence, type CoordinateSource, type MapProvider, type ParsedMapUrl } from "@/lib/map-url";
import type { PlaceSourceProvider } from "@/types/database";

export type MapLinkAnalysisResult = {
  provider: MapProvider;
  sourceProvider: PlaceSourceProvider;
  normalizedUrl: string;
  originalUrl: string;
  resolvedUrl?: string;
  title?: string;
  searchQuery?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  externalId?: string;
  coordinateSource: CoordinateSource;
  confidence: CoordinateConfidence;
  failureReason?: string;
};

export function analyzeMapLink(input: string, resolvedUrls: string[] = []): MapLinkAnalysisResult {
  const parsedUrls = [parseMapUrl(input), ...resolvedUrls.map((url) => parseMapUrl(url))];
  const primary = parsedUrls[0];
  const providerFacts = selectProviderFacts(parsedUrls);
  const coordinates = resolveCoordinates(parsedUrls);

  return {
    provider: providerFacts.provider,
    sourceProvider: providerFacts.sourceProvider,
    normalizedUrl: primary.normalizedUrl,
    originalUrl: input,
    resolvedUrl: resolvedUrls.at(-1),
    title: firstText(parsedUrls.map((parsed) => parsed.title)),
    searchQuery: firstText(parsedUrls.map((parsed) => parsed.searchQuery)),
    latitude: coordinates?.latitude,
    longitude: coordinates?.longitude,
    placeId: providerFacts.placeId,
    externalId: providerFacts.placeId,
    coordinateSource: coordinates?.coordinateSource ?? "none",
    confidence: coordinates?.confidence ?? providerFacts.confidence,
    failureReason: coordinates ? undefined : providerFacts.failureReason ?? "no_coordinates",
  };
}

export function resolveCoordinates(parsedUrls: ParsedMapUrl[]) {
  const candidates = parsedUrls.filter(
    (parsed): parsed is ParsedMapUrl & { latitude: number; longitude: number } =>
      typeof parsed.latitude === "number" && typeof parsed.longitude === "number",
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((a, b) => confidenceScore(b.confidence) - confidenceScore(a.confidence))[0];
}

function selectProviderFacts(parsedUrls: ParsedMapUrl[]) {
  const parsed = parsedUrls.find((item) => item.provider !== "unknown") ?? parsedUrls[0];
  const placeId = firstText(parsedUrls.map((item) => item.placeId));

  return {
    provider: parsed.provider,
    sourceProvider: parsed.sourceProvider,
    placeId,
    confidence: placeId ? "medium" as const : parsed.confidence,
    failureReason: parsed.failureReason,
  };
}

function confidenceScore(confidence: CoordinateConfidence) {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  if (confidence === "low") return 1;
  return 0;
}

function firstText(values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}
