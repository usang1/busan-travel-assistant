import { normalizeLatitude, normalizeLongitude } from "@/lib/map-url";
import type { NormalizedPlace } from "@/lib/place-providers/types";

export function normalizeCoordinates(latitude: unknown, longitude: unknown) {
  const normalizedLatitude = normalizeLatitude(latitude);
  const normalizedLongitude = normalizeLongitude(longitude);

  if (normalizedLatitude === null || normalizedLongitude === null) {
    return null;
  }

  if (normalizedLatitude === 0 && normalizedLongitude === 0) {
    return null;
  }

  return { latitude: normalizedLatitude, longitude: normalizedLongitude };
}

export function mergeNormalizedPlace(
  base: NormalizedPlace,
  details: Partial<NormalizedPlace> | null,
): NormalizedPlace {
  if (!details) {
    return base;
  }

  const merged = { ...base, ...removeUndefined(details) };
  const coordinates = normalizeCoordinates(merged.latitude, merged.longitude);

  if (!coordinates) {
    delete merged.latitude;
    delete merged.longitude;
  } else {
    merged.latitude = coordinates.latitude;
    merged.longitude = coordinates.longitude;
  }

  return merged;
}

export function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function stripHtml(value: unknown) {
  const normalized = text(value);
  return normalized?.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").trim() || undefined;
}

function removeUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
