import type { TripInput } from "@/lib/trip-store";
import type { TripPlaceRecord, TripRecord } from "@/types/database";

export const guestTripsStorageKey = "busan-travel-assistant-guest-trips";
export const guestTripsChangeEvent = "guest-trips-change";
export const guestUserId = "guest";

export type GuestTripStore = {
  trips: TripRecord[];
  tripPlaces: TripPlaceRecord[];
};

export function readGuestTripStore(): GuestTripStore {
  if (typeof window === "undefined") return emptyGuestTripStore();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(guestTripsStorageKey) ?? "{}") as Partial<GuestTripStore>;
    return {
      trips: Array.isArray(parsed.trips) ? parsed.trips.filter(isTripRecord) : [],
      tripPlaces: Array.isArray(parsed.tripPlaces) ? parsed.tripPlaces.filter(isTripPlaceRecord) : [],
    };
  } catch {
    return emptyGuestTripStore();
  }
}

export function writeGuestTripStore(store: GuestTripStore) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(guestTripsStorageKey, JSON.stringify({
    trips: dedupeTrips(store.trips),
    tripPlaces: dedupeTripPlaces(store.tripPlaces),
  }));
  window.dispatchEvent(new Event(guestTripsChangeEvent));
}

export function clearGuestTrips() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(guestTripsStorageKey);
  window.dispatchEvent(new Event(guestTripsChangeEvent));
}

export function createGuestTrip(input: TripInput) {
  const now = new Date().toISOString();
  const trip: TripRecord = {
    id: createLocalId("trip"),
    user_id: guestUserId,
    title: input.title.trim() || "Trip",
    start_date: input.startDate,
    end_date: input.endDate,
    visibility: input.visibility,
    share_slug: createLocalId("share"),
    client_merge_key: null,
    created_at: now,
    updated_at: now,
  };
  const store = readGuestTripStore();
  writeGuestTripStore({ ...store, trips: [trip, ...store.trips] });
  return trip;
}

export function updateGuestTrip(tripId: string, input: TripInput) {
  const now = new Date().toISOString();
  const store = readGuestTripStore();
  const nextTrips = store.trips.map((trip) => trip.id === tripId
    ? {
        ...trip,
        title: input.title.trim() || trip.title,
        start_date: input.startDate,
        end_date: input.endDate,
        visibility: input.visibility,
        updated_at: now,
      }
    : trip);
  writeGuestTripStore({ ...store, trips: nextTrips });
  return nextTrips.find((trip) => trip.id === tripId) ?? null;
}

export function deleteGuestTrip(tripId: string) {
  const store = readGuestTripStore();
  writeGuestTripStore({
    trips: store.trips.filter((trip) => trip.id !== tripId),
    tripPlaces: store.tripPlaces.filter((place) => place.trip_id !== tripId),
  });
}

export function getGuestTripPlaces(tripId: string) {
  return readGuestTripStore().tripPlaces
    .filter((place) => place.trip_id === tripId)
    .sort((a, b) => a.day_number - b.day_number || a.sort_order - b.sort_order);
}

export function addGuestPlaceToTrip(tripId: string, placeId: string, dayNumber = 1) {
  const store = readGuestTripStore();
  if (store.tripPlaces.some((item) => item.trip_id === tripId && item.place_id === placeId)) {
    return;
  }

  const now = new Date().toISOString();
  const lastOrder = Math.max(
    -1,
    ...store.tripPlaces
      .filter((item) => item.trip_id === tripId && item.day_number === dayNumber)
      .map((item) => item.sort_order),
  );
  const item: TripPlaceRecord = {
    id: createLocalId("trip-place"),
    trip_id: tripId,
    place_id: placeId,
    day_number: dayNumber,
    sort_order: lastOrder + 1,
    memo: "",
    created_at: now,
    updated_at: now,
  };

  writeGuestTripStore({ ...store, tripPlaces: [...store.tripPlaces, item] });
}

export function saveGuestTripLayout(
  tripId: string,
  layout: Array<{ placeId: string; dayNumber: number; sortOrder: number; memo?: string }>,
) {
  const store = readGuestTripStore();
  const byPlace = new Map(
    store.tripPlaces
      .filter((item) => item.trip_id === tripId)
      .map((item) => [item.place_id, item]),
  );
  const now = new Date().toISOString();
  const nextTripPlaces = [
    ...store.tripPlaces.filter((item) => item.trip_id !== tripId),
    ...layout.map((item) => {
      const existing = byPlace.get(item.placeId);
      return {
        id: existing?.id ?? createLocalId("trip-place"),
        trip_id: tripId,
        place_id: item.placeId,
        day_number: item.dayNumber,
        sort_order: item.sortOrder,
        memo: item.memo ?? existing?.memo ?? "",
        created_at: existing?.created_at ?? now,
        updated_at: now,
      } satisfies TripPlaceRecord;
    }),
  ];

  writeGuestTripStore({
    trips: touchTrip(store.trips, tripId),
    tripPlaces: nextTripPlaces,
  });
}

export function updateGuestTripPlace(
  id: string,
  patch: Partial<Pick<TripPlaceRecord, "day_number" | "sort_order" | "memo">>,
) {
  const now = new Date().toISOString();
  const store = readGuestTripStore();
  const target = store.tripPlaces.find((item) => item.id === id);
  writeGuestTripStore({
    trips: target ? touchTrip(store.trips, target.trip_id) : store.trips,
    tripPlaces: store.tripPlaces.map((item) => item.id === id ? { ...item, ...patch, updated_at: now } : item),
  });
}

export function removeGuestTripPlace(id: string) {
  const store = readGuestTripStore();
  const target = store.tripPlaces.find((item) => item.id === id);
  writeGuestTripStore({
    trips: target ? touchTrip(store.trips, target.trip_id) : store.trips,
    tripPlaces: store.tripPlaces.filter((item) => item.id !== id),
  });
}

function emptyGuestTripStore(): GuestTripStore {
  return { trips: [], tripPlaces: [] };
}

function touchTrip(trips: TripRecord[], tripId: string) {
  const now = new Date().toISOString();
  return trips.map((trip) => trip.id === tripId ? { ...trip, updated_at: now } : trip);
}

function dedupeTrips(trips: TripRecord[]) {
  const seen = new Set<string>();
  return trips.filter((trip) => {
    if (seen.has(trip.id)) return false;
    seen.add(trip.id);
    return true;
  });
}

function dedupeTripPlaces(items: TripPlaceRecord[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.trip_id}:${item.place_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createLocalId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `guest-${prefix}-${random}`;
}

function isTripRecord(value: unknown): value is TripRecord {
  if (!value || typeof value !== "object") return false;
  const trip = value as Partial<TripRecord>;
  return (
    typeof trip.id === "string" &&
    typeof trip.title === "string" &&
    typeof trip.start_date === "string" &&
    typeof trip.end_date === "string" &&
    (trip.visibility === "private" || trip.visibility === "unlisted") &&
    typeof trip.share_slug === "string" &&
    typeof trip.created_at === "string" &&
    typeof trip.updated_at === "string"
  );
}

function isTripPlaceRecord(value: unknown): value is TripPlaceRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TripPlaceRecord>;
  return (
    typeof item.id === "string" &&
    typeof item.trip_id === "string" &&
    typeof item.place_id === "string" &&
    typeof item.day_number === "number" &&
    typeof item.sort_order === "number" &&
    typeof item.memo === "string" &&
    typeof item.created_at === "string" &&
    typeof item.updated_at === "string"
  );
}
