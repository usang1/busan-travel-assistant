import type { Locale } from "@/lib/i18n";

export const guideTypes = ["AREA", "FOOD", "SITUATION", "ITINERARY", "PRACTICAL"] as const;
export type GuideType = (typeof guideTypes)[number];
export type GuideText = Record<Locale, string>;
export type GuideStop = {
  place_id: string;
  sequence: number;
  custom_title: GuideText;
  custom_description: GuideText;
  stay_minutes: number | null;
  transportation_note: GuideText;
  tip: GuideText;
};
export type GuidePayload = {
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  guide_type: GuideType;
  title_ko: string;
  title_zh: string;
  title_en: string;
  title_ja: string;
  description_ko: string;
  description_zh: string;
  description_en: string;
  description_ja: string;
  cover_image: string;
  area: string;
  estimated_duration: number | null;
  recommended_for: GuideText;
  weather_type: "ANY" | "SUNNY" | "RAINY" | "INDOOR";
  sort_order: number;
  is_featured: boolean;
  places: GuideStop[];
};
export type Guide = Omit<GuidePayload, "places"> & {
  id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
export type GuideDetail = Guide & { guide_places: GuideStop[] };
