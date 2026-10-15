import "server-only";

import { createServerAnonClient } from "@/lib/server-supabase";
import { getPlaces } from "@/lib/place-store";
import type { Locale } from "@/lib/i18n";

export type PublicStay = {
  id: string;
  slug: string;
  name: string;
  stay_type: string;
  address: string;
  road_address: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  supported_locales: Locale[];
};

export async function getPublicStayGuide(slug: string) {
  try {
    const client = createServerAnonClient();
    const { data: stay, error } = await client
      .from("stays")
      .select("id,slug,name,stay_type,address,road_address,latitude,longitude,image_url,supported_locales")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error || !stay) return { stay: null, places: [], error: error?.message || "stay_not_found" };

    const { data: recommendations, error: recommendationError } = await client
      .from("stay_recommendations")
      .select("place_id,sort_order")
      .eq("stay_id", stay.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (recommendationError) return { stay: stay as PublicStay, places: [], error: recommendationError.message };
    const ids = (recommendations ?? []).map((item) => String(item.place_id));
    if (!ids.length) return { stay: stay as PublicStay, places: [], error: "" };
    const result = await getPlaces({ activeOnly: true, ids, debugLabel: "stay-guide" }, client);
    const order = new Map(ids.map((id, index) => [id, index]));
    return {
      stay: stay as PublicStay,
      places: result.places.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)),
      error: "error" in result ? result.error || "" : "",
    };
  } catch (error) {
    return { stay: null, places: [], error: error instanceof Error ? error.message : "stay_load_failed" };
  }
}
