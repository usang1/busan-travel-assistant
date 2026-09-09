import { clearGuestTrips, readGuestTripStore } from "@/lib/guest-trips";
import { pendingPlaceSaveStorageKey, type PendingPlaceSave } from "@/lib/auth-flow";
import { recordPlaceEvent } from "@/lib/place-events";
import { readSavedItems, writeSavedItems } from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;

let activeMergeUserId = "";

export async function mergeGuestDataToAccount(userId: string, locale: Locale, client = getSupabaseClient()) {
  if (!client || !userId || activeMergeUserId === userId) {
    return { savedPlaces: 0, savedGuides: 0, trips: 0, error: "" };
  }

  activeMergeUserId = userId;

  try {
    const savedPlaceIds = getGuestSavedPlaceIds();
    const saveResult = await mergeGuestSaves(client, userId, savedPlaceIds, locale);
    if (saveResult.error) return { savedPlaces: 0, savedGuides: 0, trips: 0, error: saveResult.error };

    const savedGuideIds = getGuestSavedGuideIds();
    const guideSaveResult = await mergeGuestGuideSaves(client, userId, savedGuideIds);
    if (guideSaveResult.error) return { savedPlaces: savedPlaceIds.length, savedGuides: 0, trips: 0, error: guideSaveResult.error };

    const tripResult = await mergeGuestTrips(client, userId);
    if (tripResult.error) return { savedPlaces: savedPlaceIds.length, savedGuides: savedGuideIds.length, trips: 0, error: tripResult.error };

    writeSavedItems(readSavedItems().filter((item) => item.type !== "place" && item.type !== "guide"));
    clearGuestTrips();
    window.localStorage.removeItem(pendingPlaceSaveStorageKey);
    window.dispatchEvent(new CustomEvent("place-save-change"));
    window.dispatchEvent(new Event("guide-save-change"));

    return { savedPlaces: savedPlaceIds.length, savedGuides: savedGuideIds.length, trips: tripResult.count, error: "" };
  } finally {
    activeMergeUserId = "";
  }
}

function getGuestSavedGuideIds() {
  return Array.from(new Set(readSavedItems()
    .filter((item) => item.type === "guide")
    .map((item) => item.id)));
}

function getGuestSavedPlaceIds() {
  const ids = readSavedItems()
    .filter((item) => item.type === "place")
    .map((item) => item.id);
  const pending = readPendingPlaceSave();
  if (pending?.placeId) ids.unshift(pending.placeId);
  return Array.from(new Set(ids));
}

function readPendingPlaceSave() {
  try {
    const raw = window.localStorage.getItem(pendingPlaceSaveStorageKey);
    return raw ? JSON.parse(raw) as PendingPlaceSave : null;
  } catch {
    return null;
  }
}

async function mergeGuestSaves(client: SupabaseClient, userId: string, placeIds: string[], locale: Locale) {
  if (!placeIds.length) return { error: "" };

  const { error } = await client
    .from("place_saves")
    .upsert(
      placeIds.map((placeId) => ({ user_id: userId, place_id: placeId })),
      { onConflict: "user_id,place_id", ignoreDuplicates: true },
    );

  if (error) return { error: error.message };

  await Promise.all(placeIds.map((placeId) => recordPlaceEvent({
    eventType: "place_save",
    placeId,
    locale,
    userId,
    metadata: { source: "guest_merge" },
  })));
  return { error: "" };
}

async function mergeGuestGuideSaves(client: SupabaseClient, userId: string, guideIds: string[]) {
  if (!guideIds.length) return { error: "" };

  const { error } = await client
    .from("guide_saves")
    .upsert(
      guideIds.map((guideId) => ({ user_id: userId, guide_id: guideId })),
      { onConflict: "user_id,guide_id", ignoreDuplicates: true },
    );

  return { error: error?.message ?? "" };
}

async function mergeGuestTrips(client: SupabaseClient, userId: string) {
  const store = readGuestTripStore();
  if (!store.trips.length) return { count: 0, error: "" };

  let count = 0;

  for (const guestTrip of store.trips) {
    const clientMergeKey = `guest:${guestTrip.id}`;
    const tripPayload = {
      user_id: userId,
      title: guestTrip.title,
      start_date: guestTrip.start_date,
      end_date: guestTrip.end_date,
      visibility: guestTrip.visibility,
      client_merge_key: clientMergeKey,
    };
    let { data, error } = await client
      .from("trips")
      .upsert(tripPayload, { onConflict: "user_id,client_merge_key" })
      .select("id")
      .single();

    if (isMissingClientMergeKey(error)) {
      const fallback = await client
        .from("trips")
        .insert({
          user_id: userId,
          title: guestTrip.title,
          start_date: guestTrip.start_date,
          end_date: guestTrip.end_date,
          visibility: guestTrip.visibility,
        })
        .select("id")
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data?.id) {
      return { count, error: error?.message ?? "Trip merge failed." };
    }

    const tripId = String(data.id);
    const places = store.tripPlaces.filter((item) => item.trip_id === guestTrip.id);
    const { error: placesError } = places.length
      ? await client.from("trip_places").upsert(
          places.map((item) => ({
            trip_id: tripId,
            place_id: item.place_id,
            day_number: item.day_number,
            sort_order: item.sort_order,
            memo: item.memo,
          })),
          { onConflict: "trip_id,place_id" },
        )
      : { error: null };

    if (placesError) {
      return { count, error: placesError.message };
    }

    count += 1;
  }

  return { count, error: "" };
}

function isMissingClientMergeKey(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "PGRST204" || message.includes("client_merge_key");
}
