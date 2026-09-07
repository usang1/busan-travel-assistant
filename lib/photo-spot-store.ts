import { getSupabaseClient } from "@/lib/supabase";
import type { PhotoSpotListResult, PhotoSpotRecord } from "@/types/database";

export async function getPhotoSpots(): Promise<PhotoSpotListResult> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      photoSpots: [],
      source: "none",
    };
  }

  const { data, error } = await client
    .from("photo_spots")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return {
      photoSpots: [],
      source: "none",
      error: "사진스팟 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
    };
  }

  return {
    photoSpots: data as PhotoSpotRecord[],
    source: "supabase",
  };
}

export async function getPhotoSpotBySlug(slug: string): Promise<{ photoSpot: PhotoSpotRecord | null; source: "supabase" | "demo" | "none"; error?: string }> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      photoSpot: null,
      source: "none",
    };
  }

  const { data, error } = await client.from("photo_spots").select("*").eq("slug", slug).eq("is_active", true).single();

  if (error || !data) {
    return {
      photoSpot: null,
      source: "none",
      error: "사진스팟 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
    };
  }

  return {
    photoSpot: data as PhotoSpotRecord,
    source: "supabase",
  };
}
