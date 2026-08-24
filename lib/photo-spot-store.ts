import { demoPhotoSpots } from "@/data/demo-photo-spots";
import { getSupabaseClient } from "@/lib/supabase";
import type { PhotoSpotListResult, PhotoSpotRecord } from "@/types/database";

export async function getPhotoSpots(): Promise<PhotoSpotListResult> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      photoSpots: demoPhotoSpots,
      source: "demo",
      error: "Supabase 환경 변수가 없어 demo 사진스팟을 사용합니다.",
    };
  }

  const { data, error } = await client
    .from("photo_spots")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return {
      photoSpots: demoPhotoSpots,
      source: "demo",
      error: error?.message ?? "사진스팟 데이터를 불러오지 못했습니다.",
    };
  }

  return {
    photoSpots: data as PhotoSpotRecord[],
    source: "supabase",
  };
}

export async function getPhotoSpotBySlug(slug: string): Promise<{ photoSpot: PhotoSpotRecord | null; source: "supabase" | "demo"; error?: string }> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      photoSpot: demoPhotoSpots.find((spot) => spot.slug === slug) ?? null,
      source: "demo",
      error: "Supabase 환경 변수가 없어 demo 사진스팟을 사용합니다.",
    };
  }

  const { data, error } = await client.from("photo_spots").select("*").eq("slug", slug).eq("is_active", true).single();

  if (error || !data) {
    return {
      photoSpot: demoPhotoSpots.find((spot) => spot.slug === slug) ?? null,
      source: "demo",
      error: error?.message ?? "사진스팟을 찾지 못했습니다.",
    };
  }

  return {
    photoSpot: data as PhotoSpotRecord,
    source: "supabase",
  };
}
