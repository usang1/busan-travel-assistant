import { parseMapUrl } from "@/lib/map-url";

export type SubmissionLocationInput = {
  mapUrl: string;
  name: string;
  locationText: string;
};

export type SubmissionLocationValidation = {
  valid: boolean;
  mode: "map" | "manual" | "none";
  error: "invalid_map_url" | "missing_place_location" | null;
};

export function validateSubmissionLocation(input: SubmissionLocationInput): SubmissionLocationValidation {
  const mapUrl = input.mapUrl.normalize("NFKC").trim();
  if (mapUrl) {
    const parsed = parseMapUrl(mapUrl);
    const validMap = parsed.provider !== "unknown" && /^https?:\/\//i.test(parsed.normalizedUrl);
    return validMap
      ? { valid: true, mode: "map", error: null }
      : { valid: false, mode: "none", error: "invalid_map_url" };
  }

  if (input.name.trim() && input.locationText.trim()) return { valid: true, mode: "manual", error: null };
  return { valid: false, mode: "none", error: "missing_place_location" };
}

export function buildSubmissionDuplicateSource(input: SubmissionLocationInput) {
  const validation = validateSubmissionLocation(input);
  if (!validation.valid) return "";
  if (validation.mode === "map") return `map:${parseMapUrl(input.mapUrl).normalizedUrl.toLowerCase()}`;
  return `manual:${normalizeKey(input.name)}|${normalizeKey(input.locationText)}`;
}

function normalizeKey(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}
