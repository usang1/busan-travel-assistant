import { getSupabaseClient } from "@/lib/supabase";
import { getAnalyticsMetadata } from "@/lib/analytics-source";
import type { Locale } from "@/lib/i18n";
import type { PlaceActionEventType } from "@/types/database";

type RecordPlaceEventInput = {
  eventType: PlaceActionEventType;
  locale: Locale;
  placeId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

const forbiddenMetadataKey = /(email|phone|token|secret|password|session|cookie|authorization|query|search_text|request_text|source_url|full_url|latitude|longitude|coordinates|address|notes)/i;
const metadataKeyPattern = /^[a-z][a-z0-9_]{0,47}$/;

export async function recordPlaceEvent({
  eventType,
  locale,
  placeId = null,
  userId = null,
  metadata = {},
}: RecordPlaceEventInput) {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  try {
    await client.from("place_action_events").insert({
      event_type: eventType,
      locale,
      place_id: placeId,
      user_id: userId,
      metadata: sanitizeAnalyticsMetadata(getAnalyticsMetadata(metadata)),
    });
  } catch {
    // Analytics must never block the core user action.
  }
}

export const recordProductEvent = recordPlaceEvent;

export function sanitizeAnalyticsMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, string | number | boolean | null | Array<string | number | boolean>> = {};

  for (const [key, rawValue] of Object.entries(metadata).slice(0, 32)) {
    if (!metadataKeyPattern.test(key) || forbiddenMetadataKey.test(key)) continue;
    const value = sanitizeValue(rawValue);
    if (value !== undefined) sanitized[key] = value;
  }

  return sanitized;
}

function sanitizeValue(value: unknown): string | number | boolean | null | Array<string | number | boolean> | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const items: Array<string | number | boolean> = [];
    for (const item of value.slice(0, 10)) {
      if (typeof item === "string") items.push(item.slice(0, 80));
      else if (typeof item === "number" && Number.isFinite(item)) items.push(item);
      else if (typeof item === "boolean") items.push(item);
    }
    return items;
  }
  return undefined;
}
