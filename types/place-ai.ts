import type { PlaceCategory, PlaceFactTristate, PlaceSourceProvider } from "@/types/database";

export type PlaceSourceData = {
  name: string;
  category: PlaceCategory;
  address: string;
  latitude: number | null;
  longitude: number | null;
  map_url: string;
  provider: PlaceSourceProvider;
  source_external_id: string | null;
  nearest_station: string;
  opening_hours: string;
  menu: Array<{
    name_ko: string;
    name_zh: string;
    description_zh: string;
    price: number | null;
    is_recommended: boolean;
  }>;
  price: {
    level: number | null;
    min: number | null;
    max: number | null;
  };
  parking: PlaceFactTristate;
  toilet: PlaceFactTristate;
  card_payment: PlaceFactTristate;
  solo_friendly: PlaceFactTristate;
  waiting_info: string;
  source: "admin_form" | "map_link";
};

export type PlaceAiGeneratedContent = {
  description_ko: string;
  description_zh: string;
  description_en: string;
  description_ja: string;
  short_summary: string;
  highlights: string[];
  traveler_tips: string[];
  recommended_for: string[];
  cautions: string[];
};

export type PlaceAiGenerationRequest = {
  source_data: PlaceSourceData;
  locale_targets: Array<"ko" | "zh" | "en" | "ja">;
  existing_content?: Partial<PlaceAiGeneratedContent>;
};

export type PlaceAiGenerationStatus = "prepared" | "not_implemented" | "failed";

export type PlaceAiGenerationResponse = {
  status: PlaceAiGenerationStatus;
  source_data: PlaceSourceData;
  generated_content: PlaceAiGeneratedContent;
  message: string;
};
