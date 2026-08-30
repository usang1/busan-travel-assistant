import type { PlaceCategory, PlaceFactTristate, PlaceSourceProvider } from "@/types/database";

export type PlaceMapSourceType = "naver" | "kakao" | "google" | "unknown";

export type PlaceMapLinkFacts = {
  source_type: PlaceMapSourceType;
  normalized_url: string;
  external_id: string | null;
};

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
  map_link_facts?: PlaceMapLinkFacts;
};

export type PlaceAiGeneratedContent = {
  description_ko: string;
  description_zh: string;
  description_en: string;
  description_ja: string;
  short_summary: string;
  short_summary_ko: string;
  short_summary_zh: string;
  short_summary_en: string;
  short_summary_ja: string;
  highlights: string[];
  traveler_tips: string[];
  recommended_for: string[];
  cautions: string[];
};

export type PlaceAiGenerationApiContent = {
  description: {
    ko: string;
    zh: string;
    en: string;
    ja: string;
  };
  shortSummary: {
    ko: string;
    zh: string;
    en: string;
    ja: string;
  };
  highlights: string[];
  travelerTips: string[];
  recommendedFor: string[];
  cautions: string[];
};

export type PlaceAiGenerationRequest = {
  source_data: PlaceSourceData;
  locale_targets: Array<"ko" | "zh" | "en" | "ja">;
  existing_content?: Partial<PlaceAiGeneratedContent>;
};

export type PlaceAiGenerationStatus = "prepared" | "generated" | "failed";

export type PlaceAiGenerationResponse = {
  status: PlaceAiGenerationStatus;
  source_data: PlaceSourceData;
  generated_content: PlaceAiGeneratedContent;
  api_content: PlaceAiGenerationApiContent;
  description: PlaceAiGenerationApiContent["description"];
  shortSummary: PlaceAiGenerationApiContent["shortSummary"];
  highlights: string[];
  travelerTips: string[];
  recommendedFor: string[];
  cautions: string[];
  model?: string;
  generated_at?: string;
  content_version?: string;
  message: string;
};
