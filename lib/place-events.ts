import { getSupabaseClient } from "@/lib/supabase";
import { captureSessionAttribution, getAnalyticsMetadata, readSessionAttribution } from "@/lib/analytics-source";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics-schema";
import type { Locale } from "@/lib/i18n";
import type { PlaceActionEventType } from "@/types/database";

type RecordPlaceEventInput = {
  eventType: PlaceActionEventType;
  locale: Locale;
  placeId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordPlaceEvent({
  eventType,
  locale,
  placeId = null,
  userId = null,
  metadata = {},
}: RecordPlaceEventInput) {
  try {
    captureSessionAttribution();
    const attribution = readSessionAttribution();
    if (!attribution?.visit_id) return;
    const client = getSupabaseClient();
    const session = client ? (await client.auth.getSession()).data.session : null;
    const enrichedMetadata = sanitizeAnalyticsMetadata(getAnalyticsMetadata(metadata));
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        eventId: createEventId(),
        eventName: eventType,
        placeId,
        anonymousSessionId: attribution.visit_id,
        sourcePage: window.location.pathname,
        referrer: document.referrer,
        campaignId: attribution.campaign_id,
        locale,
        deviceType: browserDeviceType(),
        metadata: enrichedMetadata,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the core user action.
  }
}

export const recordProductEvent = recordPlaceEvent;

/**
 * Records a server-side product event without allowing analytics availability to
 * affect the action that the user asked us to perform. Some route tests and
 * migration rollouts intentionally use clients that do not expose the events
 * table yet, so both synchronous query-builder failures and Supabase errors are
 * ignored here.
 */
export async function recordServerPlaceEvent(
  client: { from: (table: string) => { insert: (value: Record<string, unknown>) => PromiseLike<unknown> } },
  value: Record<string, unknown>,
) {
  try {
    await client.from("place_action_events").insert(value);
  } catch {
    // Analytics must never block the core server action.
  }
}

export { sanitizeAnalyticsMetadata } from "@/lib/analytics-schema";

function createEventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : fallbackUuid();
}

function fallbackUuid() {
  const bytes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  bytes[12] = "4";
  bytes[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
  const hex = bytes.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function browserDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  if (/ipad|tablet/iu.test(navigator.userAgent)) return "tablet";
  return /mobile|android|iphone/iu.test(navigator.userAgent) ? "mobile" : "desktop";
}
