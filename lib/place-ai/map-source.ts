import { parseMapUrl } from "@/lib/map-url";
import type { PlaceMapLinkFacts, PlaceMapSourceType } from "@/types/place-ai";

export function analyzePlaceMapSource(value: string): PlaceMapLinkFacts {
  const trimmed = value.trim();

  if (!trimmed) {
    return { source_type: "unknown", normalized_url: "", external_id: null };
  }

  try {
    const url = new URL(trimmed);
    const parsed = parseMapUrl(url.toString());
    const sourceType = toMapSourceType(parsed.provider);

    return {
      source_type: sourceType,
      normalized_url: url.toString(),
      external_id: extractMapExternalId(url, sourceType),
    };
  } catch {
    return { source_type: "unknown", normalized_url: trimmed.slice(0, 500), external_id: null };
  }
}

function toMapSourceType(provider: ReturnType<typeof parseMapUrl>["provider"]): PlaceMapSourceType {
  if (provider === "naver") return "naver";
  if (provider === "kakao") return "kakao";
  if (provider === "google") return "google";
  return "unknown";
}

function extractMapExternalId(url: URL, sourceType: PlaceMapSourceType) {
  if (sourceType === "naver") {
    const pathnameId = url.pathname.match(/\/(?:entry\/place|place)\/(\d+)/)?.[1];
    return pathnameId ?? url.searchParams.get("placeId") ?? url.searchParams.get("pinId");
  }

  if (sourceType === "kakao") {
    return url.pathname.match(/\/(\d+)(?:$|[/?#])/)?.[1] ?? url.searchParams.get("itemId");
  }

  if (sourceType === "google") {
    return url.searchParams.get("cid") ?? url.searchParams.get("ftid") ?? null;
  }

  return null;
}
