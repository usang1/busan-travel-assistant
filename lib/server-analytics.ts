import "server-only";
import { randomUUID } from "node:crypto";
import { createServerServiceClient } from "@/lib/server-supabase";
import { sanitizeAnalyticsMetadata } from "@/lib/analytics-schema";
import type { Locale, } from "@/lib/i18n";
import type { PlaceActionEventType } from "@/types/database";

export async function recordServerAnalyticsEvent(input: {
  eventName: PlaceActionEventType;
  legacyEventName?: PlaceActionEventType;
  placeId?: string | null;
  userId?: string | null;
  anonymousSessionId?: string | null;
  locale?: Locale;
  metadata?: Record<string, unknown>;
}) {
  try {
    const client = createServerServiceClient();
    const id = randomUUID();
    const metadata = sanitizeAnalyticsMetadata(input.metadata ?? {});
    const { error } = await client.from("place_action_events").insert({
      id,
      client_event_id: id,
      event_type: input.eventName,
      place_id: input.placeId ?? null,
      user_id: input.userId ?? null,
      anonymous_session_id: input.anonymousSessionId ?? null,
      locale: input.locale ?? "ko",
      occurred_at: new Date().toISOString(),
      channel: typeof metadata.channel === "string" ? metadata.channel : null,
      campaign_id: typeof metadata.campaign_id === "string" ? metadata.campaign_id : null,
      metadata,
    });
    if (!error) return;
    if (!["42703", "PGRST204", "PGRST205", "22P02"].includes(error.code || "")) return;
    await client.from("place_action_events").insert({
      id,
      event_type: input.legacyEventName ?? input.eventName,
      place_id: input.placeId ?? null,
      user_id: input.userId ?? null,
      locale: input.locale ?? "ko",
      metadata: {
        ...metadata,
        ...(input.anonymousSessionId ? { visit_id: input.anonymousSessionId } : {}),
      },
    });
  } catch {
    // Analytics availability must never change the result of the core action.
  }
}
