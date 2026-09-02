import { getPublicPlacesByIds } from "@/lib/place-store";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  PlaceWithRelations,
  SharedTripWithPlaces,
  TripPlaceRecord,
  TripPlaceWithPlace,
  TripRecord,
  TripVisibility,
  TripWithPlaces,
} from "@/types/database";

export type TripInput = {
  title: string;
  startDate: string;
  endDate: string;
  visibility: TripVisibility;
};

export async function getUserTrips(userId: string, client = getSupabaseClient()) {
  if (!client) return { trips: [] as TripRecord[], error: "Supabase가 설정되지 않았습니다." };
  const { data, error } = await client
    .from("trips")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return { trips: (data ?? []) as TripRecord[], error: error?.message };
}

export async function getTripWithPlaces(trip: TripRecord, client = getSupabaseClient()): Promise<TripWithPlaces> {
  const tripPlaces = await getTripPlaces(trip.id, client);
  return { ...trip, trip_places: tripPlaces };
}

export async function getPublicTripByShareSlug(shareSlug: string): Promise<SharedTripWithPlaces | null> {
  const client = getSupabaseClient();
  if (!client || !shareSlug.trim()) return null;
  const { data, error } = await client.rpc("get_shared_trip", { source_share_slug: shareSlug });
  if (error || !Array.isArray(data) || !data.length) return null;
  const rows = data as SharedTripRpcRow[];
  const first = rows[0];
  const placeIds = rows.flatMap((row) => row.place_id ? [row.place_id] : []);
  const places = await getPublicPlacesByIds(placeIds, client);
  const byId = new Map(places.map((place) => [place.id, place]));
  const tripPlaces = rows.flatMap((row) => {
    const place = row.place_id ? byId.get(row.place_id) : null;
    if (!row.trip_place_id || !row.place_id || !place) return [];
    return [{
      id: row.trip_place_id,
      trip_id: row.trip_id,
      place_id: row.place_id,
      day_number: row.day_number ?? 1,
      sort_order: row.sort_order ?? 0,
      memo: row.memo ?? "",
      created_at: row.trip_place_created_at ?? first.trip_created_at,
      updated_at: row.trip_place_updated_at ?? first.trip_updated_at,
      place,
    } satisfies TripPlaceWithPlace];
  });

  return {
    id: first.trip_id,
    title: first.title,
    start_date: first.start_date,
    end_date: first.end_date,
    visibility: first.visibility,
    share_slug: first.share_slug,
    created_at: first.trip_created_at,
    updated_at: first.trip_updated_at,
    trip_places: tripPlaces,
  } satisfies SharedTripWithPlaces;
}

export async function getTripPlaces(tripId: string, client = getSupabaseClient()): Promise<TripPlaceWithPlace[]> {
  if (!client) return [];
  const { data, error } = await client
    .from("trip_places")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  const rows = data as TripPlaceRecord[];
  const places = await getPublicPlacesByIds(rows.map((row) => row.place_id), client);
  const byId = new Map(places.map((place) => [place.id, place]));

  return rows.flatMap((row) => {
    const place = byId.get(row.place_id);
    return place ? [{ ...row, place }] : [];
  });
}

export async function getSavedPlacesForTrip(userId: string, client = getSupabaseClient()): Promise<PlaceWithRelations[]> {
  if (!client) return [];
  const { data, error } = await client
    .from("place_saves")
    .select("place_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const ids = (data as Array<{ place_id: string }>).map((row) => row.place_id);
  const places = await getPublicPlacesByIds(ids, client);
  const byId = new Map(places.map((place) => [place.id, place]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function createTrip(userId: string, input: TripInput, client = getSupabaseClient()) {
  if (!client) return { trip: null, error: "Supabase가 설정되지 않았습니다." };
  const { data, error } = await client
    .from("trips")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      visibility: input.visibility,
    })
    .select("*")
    .single();

  return { trip: data as TripRecord | null, error: error?.message };
}

export async function updateTrip(tripId: string, input: TripInput, client = getSupabaseClient()) {
  if (!client) return { trip: null, error: "Supabase가 설정되지 않았습니다." };
  const { data, error } = await client
    .from("trips")
    .update({
      title: input.title.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      visibility: input.visibility,
    })
    .eq("id", tripId)
    .select("*")
    .single();
  return { trip: data as TripRecord | null, error: error?.message };
}

export async function deleteTrip(tripId: string, client = getSupabaseClient()) {
  if (!client) return "Supabase가 설정되지 않았습니다.";
  const { error } = await client.from("trips").delete().eq("id", tripId);
  return error?.message;
}

export async function addPlaceToTrip(tripId: string, placeId: string, dayNumber = 1, client = getSupabaseClient()) {
  if (!client) return "Supabase가 설정되지 않았습니다.";
  const { data: lastRows } = await client
    .from("trip_places")
    .select("sort_order")
    .eq("trip_id", tripId)
    .eq("day_number", dayNumber)
    .order("sort_order", { ascending: false })
    .limit(1);
  const lastOrder = Number((lastRows as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? -1);
  const { error } = await client.from("trip_places").upsert({
    trip_id: tripId,
    place_id: placeId,
    day_number: dayNumber,
    sort_order: lastOrder + 1,
  }, { onConflict: "trip_id,place_id", ignoreDuplicates: true });
  return error?.message;
}

export async function saveTripLayout(
  tripId: string,
  layout: Array<{ placeId: string; dayNumber: number; sortOrder: number; memo?: string }>,
  client = getSupabaseClient(),
) {
  if (!client) return "Supabase가 설정되지 않았습니다.";
  if (!layout.length) return undefined;
  const { error } = await client.from("trip_places").upsert(
    layout.map((item) => ({
      trip_id: tripId,
      place_id: item.placeId,
      day_number: item.dayNumber,
      sort_order: item.sortOrder,
      memo: item.memo ?? "",
    })),
    { onConflict: "trip_id,place_id" },
  );
  return error?.message;
}

export async function updateTripPlace(
  id: string,
  patch: Partial<Pick<TripPlaceRecord, "day_number" | "sort_order" | "memo">>,
  client = getSupabaseClient(),
) {
  if (!client) return "Supabase가 설정되지 않았습니다.";
  const { error } = await client.from("trip_places").update(patch).eq("id", id);
  return error?.message;
}

export async function removeTripPlace(id: string, client = getSupabaseClient()) {
  if (!client) return "Supabase가 설정되지 않았습니다.";
  const { error } = await client.from("trip_places").delete().eq("id", id);
  return error?.message;
}

export async function copySharedTrip(shareSlug: string, title: string, client = getSupabaseClient()) {
  if (!client) return { tripId: null, error: "Supabase가 설정되지 않았습니다." };
  const { data, error } = await client.rpc("copy_shared_trip", {
    source_share_slug: shareSlug,
    requested_title: title.trim() || null,
  });
  return { tripId: typeof data === "string" ? data : null, error: error?.message };
}

export function normalizeTripDayOrders(items: TripPlaceWithPlace[]) {
  const byDay = new Map<number, TripPlaceWithPlace[]>();
  items.forEach((item) => byDay.set(item.day_number, [...(byDay.get(item.day_number) ?? []), item]));
  return Array.from(byDay.values()).flatMap((dayItems) =>
    dayItems
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item, sortOrder) => ({ ...item, sort_order: sortOrder })),
  );
}

type SharedTripRpcRow = {
  trip_id: string;
  title: string;
  start_date: string;
  end_date: string;
  visibility: "unlisted";
  share_slug: string;
  trip_created_at: string;
  trip_updated_at: string;
  trip_place_id: string | null;
  place_id: string | null;
  day_number: number | null;
  sort_order: number | null;
  memo: string | null;
  trip_place_created_at: string | null;
  trip_place_updated_at: string | null;
};
