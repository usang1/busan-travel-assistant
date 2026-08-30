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
      normalized_url: parsed.normalizedUrl,
      external_id: parsed.placeId ?? null,
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
