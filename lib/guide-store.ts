import { createClient } from "@supabase/supabase-js";
import type { PlaceCategory } from "@/types/database";
import type { Guide, GuideDetail, GuideStop } from "@/types/guide";

// Public server reads never inherit an administrator's browser session.
export function createPublicGuideClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
}
export async function getPublishedGuides(): Promise<{ guides: Guide[]; unavailable: boolean }> {
  const client = createPublicGuideClient();
  if (!client) return { guides: [], unavailable: true };
  try {
    const guides: Guide[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("guides").select("*").eq("status", "PUBLISHED")
        .order("is_featured", { ascending: false }).order("sort_order").order("id").range(offset, offset + 499);
      if (error) return { guides: [], unavailable: true };
      guides.push(...(data as Guide[]));
      if (data.length < 500) return { guides, unavailable: false };
    }
  } catch { return { guides: [], unavailable: true }; }
}
export async function getPublishedGuide(slug: string): Promise<GuideDetail | null> {
  const client = createPublicGuideClient();
  if (!client) throw new Error("Guide service unavailable");
  const { data, error } = await client.from("guides").select("*,guide_places(*)")
    .eq("slug", slug).eq("status", "PUBLISHED").maybeSingle();
  if (error) throw new Error("Guide service unavailable");
  if (!data) return null;
  const guide = data as GuideDetail;
  guide.guide_places.sort((a, b) => a.sequence - b.sequence);
  return guide;
}

export async function getPublishedGuidesByIds(ids: string[]): Promise<Guide[]> {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean).slice(0, 80);
  if (!uniqueIds.length) return [];

  const client = createPublicGuideClient();
  if (!client) return [];

  const { data, error } = await client
    .from("guides")
    .select("*")
    .eq("status", "PUBLISHED")
    .in("id", uniqueIds);

  if (error || !data) return [];

  const byId = new Map((data as Guide[]).map((guide) => [guide.id, guide]));
  return uniqueIds.flatMap((id) => {
    const guide = byId.get(id);
    return guide ? [guide] : [];
  });
}

export async function getRelatedGuidesForPlace(input: { placeId: string; area?: string; category?: PlaceCategory; limit?: number }): Promise<Guide[]> {
  const client = createPublicGuideClient();
  if (!client) return [];

  const limit = Math.max(1, Math.min(input.limit ?? 4, 8));
  const { guides } = await getPublishedGuideDetails(client);
  const categoryTerms = input.category ? guideCategoryTerms[input.category] : [];
  const area = input.area?.trim() ?? "";

  return guides
    .map((candidate) => {
      const searchText = `${candidate.title_ko} ${candidate.title_zh} ${candidate.title_en} ${candidate.title_ja} ${candidate.description_ko} ${candidate.description_zh} ${candidate.area}`.toLowerCase();
      const includesPlace = candidate.guide_places.some((stop) => stop.place_id === input.placeId);
      const areaMatches = Boolean(area && candidate.area === area);
      const categoryMatches = categoryTerms.some((term) => searchText.includes(term));

      return {
        guide: candidate,
        score:
          (includesPlace ? 8 : 0) +
          (areaMatches ? 4 : 0) +
          (categoryMatches ? 2 : 0) +
          (candidate.is_featured ? 1 : 0),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.guide.sort_order - b.guide.sort_order || a.guide.title_ko.localeCompare(b.guide.title_ko, "ko"))
    .slice(0, limit)
    .map((item) => {
      const { guide_places: _stops, ...guide } = item.guide;
      return guide;
    });
}

export async function getRelatedGuidesForGuide(guide: GuideDetail, limit = 4): Promise<Guide[]> {
  const client = createPublicGuideClient();
  if (!client) return [];

  const { guides } = await getPublishedGuideDetails(client);
  const guidePlaceIds = new Set(guide.guide_places.map((stop) => stop.place_id));
  const related = guides
    .filter((candidate) => candidate.id !== guide.id)
    .map((candidate) => ({
      guide: candidate,
      score:
        (candidate.area && candidate.area === guide.area ? 4 : 0) +
        (candidate.guide_type === guide.guide_type ? 3 : 0) +
        sharedStopCount(candidate.guide_places, guidePlaceIds) * 2 +
        (candidate.is_featured ? 1 : 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.guide.sort_order - b.guide.sort_order || a.guide.title_ko.localeCompare(b.guide.title_ko, "ko"))
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map((item) => {
      const { guide_places: _stops, ...candidate } = item.guide;
      return candidate;
    });

  return related;
}

async function getPublishedGuideDetails(client = createPublicGuideClient()): Promise<{ guides: GuideDetail[]; unavailable: boolean }> {
  if (!client) return { guides: [], unavailable: true };

  const { data, error } = await client
    .from("guides")
    .select("*,guide_places(*)")
    .eq("status", "PUBLISHED")
    .order("is_featured", { ascending: false })
    .order("sort_order")
    .limit(200);

  if (error || !data) return { guides: [], unavailable: true };

  return {
    guides: (data as GuideDetail[]).map((guide) => ({
      ...guide,
      guide_places: [...guide.guide_places].sort((a, b) => a.sequence - b.sequence),
    })),
    unavailable: false,
  };
}

function sharedStopCount(stops: GuideStop[], placeIds: Set<string>) {
  return stops.reduce((count, stop) => count + (placeIds.has(stop.place_id) ? 1 : 0), 0);
}

const guideCategoryTerms: Record<PlaceCategory, string[]> = {
  restaurant: ["맛집", "음식", "식당", "美食", "餐厅", "food", "restaurant"],
  cafe: ["카페", "咖啡", "cafe", "coffee"],
  bar: ["술", "바", "酒", "bar", "night"],
  attraction: ["관광", "명소", "景点", "观光", "attraction"],
  shopping: ["쇼핑", "购物", "shopping"],
  photo_spot: ["사진", "포토", "拍照", "photo"],
  luggage: ["짐", "보관", "行李", "luggage"],
};
