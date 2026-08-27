import { getSupabaseClient } from "@/lib/supabase";
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
      metadata,
    });
  } catch {
    // Analytics must never block the core user action.
  }
}
