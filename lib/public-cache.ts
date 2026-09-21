import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  publicGuidesCacheTag,
  publicPageRevalidateSeconds,
  publicPhotoSpotsCacheTag,
  publicPlacesCacheTag,
} from "@/lib/cache-tags";
import { getPublishedGuides, getRelatedGuidesForPlace } from "@/lib/guide-store";
import { getPhotoSpots } from "@/lib/photo-spot-store";
import { getPlaceRankings } from "@/lib/place-recommendations";
import { getPlaceBySlug, getPlaces } from "@/lib/place-store";
import type { Locale } from "@/lib/i18n";
import type { PlaceCity } from "@/lib/city-regions";
import type { PlaceCategory } from "@/types/database";

function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && key
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;
}

export const getCachedPublicPlaces = unstable_cache(
  async (locale?: Locale, cityCode?: PlaceCity) => {
    const client = createPublicSupabaseClient();
    return getPlaces({ activeOnly: true, locale, cityCode, debugLabel: "cached-public-places" }, client ?? undefined);
  },
  ["public-places"],
  {
    tags: [publicPlacesCacheTag],
    revalidate: publicPageRevalidateSeconds,
  },
);

export const getCachedPublicPlaceBySlug = unstable_cache(
  async (slug: string) => {
    const client = createPublicSupabaseClient();
    return getPlaceBySlug(slug, { activeOnly: true, cityCode: "busan" }, client ?? undefined);
  },
  ["public-place-by-slug"],
  {
    tags: [publicPlacesCacheTag],
    revalidate: publicPageRevalidateSeconds,
  },
);

export const getCachedPlaceRankings = unstable_cache(
  async (options: { limit?: number; category?: PlaceCategory; region?: string }) => getPlaceRankings(options),
  ["public-place-rankings"],
  {
    tags: [publicPlacesCacheTag],
    revalidate: publicPageRevalidateSeconds,
  },
);

export const getCachedPublishedGuides = unstable_cache(
  async () => getPublishedGuides(),
  ["public-guides"],
  {
    tags: [publicGuidesCacheTag],
    revalidate: publicPageRevalidateSeconds,
  },
);

export const getCachedRelatedGuidesForPlace = unstable_cache(
  async (input: { placeId: string; area?: string; category?: PlaceCategory; limit?: number }) => getRelatedGuidesForPlace(input),
  ["related-guides-for-place"],
  {
    tags: [publicGuidesCacheTag, publicPlacesCacheTag],
    revalidate: publicPageRevalidateSeconds,
  },
);

export const getCachedPhotoSpots = unstable_cache(
  async () => getPhotoSpots(),
  ["public-photo-spots"],
  {
    tags: [publicPhotoSpotsCacheTag],
    revalidate: publicPageRevalidateSeconds,
  },
);
