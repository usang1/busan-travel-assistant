import { getSupabaseClient } from "@/lib/supabase";

type SaveCountRow = {
  place_id: string;
  save_count: number | string;
};

export async function getPlaceSaveCounts(placeIds: string[]) {
  const client = getSupabaseClient();
  const uniqueIds = Array.from(new Set(placeIds)).filter(Boolean);

  if (!client || uniqueIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await client.rpc("get_place_save_counts", { place_ids: uniqueIds });

  if (error || !data) {
    return new Map<string, number>();
  }

  return new Map(
    (data as SaveCountRow[]).map((row) => [
      row.place_id,
      typeof row.save_count === "number" ? row.save_count : Number(row.save_count),
    ]),
  );
}

export function withPlaceSaveCounts<T extends { id: string; save_count?: number }>(
  places: T[],
  counts: Map<string, number>,
) {
  return places.map((place) => ({
    ...place,
    save_count: counts.get(place.id) ?? 0,
  }));
}
