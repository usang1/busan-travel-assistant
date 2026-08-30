export const placeCategories = [
  "restaurant",
  "cafe",
  "bar",
  "attraction",
  "shopping",
  "photo_spot",
  "luggage",
] as const;

export type PlaceCategory = (typeof placeCategories)[number];

export type PlaceSourceProvider = "NAVER" | "KAKAO" | "GOOGLE" | "MANUAL";

export type PlaceFactTristate = "yes" | "no" | "unknown";

export type ChinaWaitingLevel = "unknown" | "none" | "short" | "moderate" | "long" | "extreme" | "varies";

export type ChinaMinimumOrderPolicy = "unknown" | "none" | "two_plus" | "three_plus" | "other";

export type PlaceVerificationStatus = "unverified" | "pending" | "verified" | "needs_review";

export type PlaceRecord = {
  id: string;
  slug: string;
  name_zh: string;
  name_ko: string;
  category: PlaceCategory;
  address?: string;
  short_description_zh: string;
  short_description_ko: string;
  address_ko: string;
  address_zh: string;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  website?: string | null;
  price_level?: number | null;
  status?: string;
  nearest_station: string;
  nearest_exit: string;
  walking_minutes: number;
  price_min: number | null;
  price_max: number | null;
  opening_hours: string;
  waiting_info_zh: string;
  waiting_info_ko: string;
  solo_friendly: boolean;
  luggage_friendly: boolean;
  chinese_menu: boolean;
  card_payment: boolean;
  recommended_order_zh: string;
  recommended_order_ko: string;
  tips_zh: string;
  tips_ko: string;
  thumbnail_url: string;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlaceTranslationRecord = {
  id: string;
  place_id: string;
  locale: "zh" | "en" | "ja" | "ko";
  name: string;
  description: string;
  travel_tip: string;
  created_at: string;
  updated_at: string;
};

export type TagRecord = {
  id: string;
  label_zh: string;
  label_ko: string;
  slug: string;
};

export type PlaceMenuItem = {
  id: string;
  place_id: string;
  name_ko: string;
  name_zh: string;
  description_zh: string;
  price: number | null;
  is_recommended: boolean;
  sort_order: number;
};

export type PlaceChinaInfoRecord = {
  id: string;
  place_id: string;
  chinese_taste_score: number | null;
  spicy_level: number | null;
  greasy_level: number | null;
  smell_level: number | null;
  portion_level: number | null;
  ordering_difficulty: number | null;
  waiting_level: ChinaWaitingLevel;
  waiting_minutes_min: number | null;
  waiting_minutes_max: number | null;
  chinese_menu: PlaceFactTristate;
  foreign_card: PlaceFactTristate;
  alipay: PlaceFactTristate;
  wechat_pay: PlaceFactTristate;
  solo_friendly: PlaceFactTristate;
  luggage_friendly: PlaceFactTristate;
  toilet_available: PlaceFactTristate;
  reservation_required: PlaceFactTristate;
  minimum_order_people: number | null;
  minimum_order_policy: ChinaMinimumOrderPolicy;
  minimum_order_note?: string | null;
  xiaohongshu_popular: PlaceFactTristate;
  photo_recommended: PlaceFactTristate;
  tourism_recommended: PlaceFactTristate;
  subway_walk_minutes: number | null;
  manual_summary_override?: string | null;
  manual_warning_override?: string | null;
  verification_status: PlaceVerificationStatus;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaceWithRelations = PlaceRecord & {
  tags: TagRecord[];
  menu_items: PlaceMenuItem[];
  translations?: PlaceTranslationRecord[];
  sources?: PlaceSourceRecord[];
  china_info?: PlaceChinaInfoRecord | null;
  save_count?: number;
};

export type PlaceSourceRecord = {
  id: string;
  place_id: string;
  provider: PlaceSourceProvider;
  external_id?: string | null;
  source_url?: string | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaceAiGenerationDraftStatus = "draft" | "applied" | "discarded" | "failed";

export type PlaceAiGenerationDraftRecord = {
  id: string;
  place_id: string | null;
  provider: PlaceSourceProvider;
  source_url?: string | null;
  source_external_id?: string | null;
  source_data: Record<string, unknown>;
  generated_content: Record<string, unknown>;
  status: PlaceAiGenerationDraftStatus;
  created_by?: string | null;
  applied_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaceSaveRecord = {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
};

export type PlaceCorrectionStatus = "pending" | "accepted" | "rejected";

export type PlaceCorrectionRecord = {
  id: string;
  place_id: string;
  user_id: string | null;
  locale: "zh" | "en" | "ja" | "ko";
  field_name: string;
  current_value?: string | null;
  suggested_value: string;
  source_url?: string | null;
  notes: string;
  status: PlaceCorrectionStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  places?: Pick<PlaceRecord, "id" | "slug" | "name_zh" | "name_ko" | "category"> | null;
};

export type PlaceActionEventType =
  | "place_view"
  | "place_save"
  | "place_unsave"
  | "marker_click"
  | "directions_click"
  | "share"
  | "submission_created"
  | "correction_submitted";

export type PlacePayload = Omit<PlaceRecord, "id" | "created_at" | "updated_at"> & {
  tags: Array<Pick<TagRecord, "label_zh" | "label_ko" | "slug">>;
  menu_items: Array<Omit<PlaceMenuItem, "id" | "place_id">>;
  translations?: Array<Pick<PlaceTranslationRecord, "locale" | "name" | "description" | "travel_tip">>;
  source?: {
    provider: PlaceSourceProvider;
    source_url?: string | null;
    external_id?: string | null;
  };
  china_info?: PlaceChinaInfoPayload | null;
};

export type PlaceChinaInfoPayload = Omit<PlaceChinaInfoRecord, "id" | "place_id" | "created_at" | "updated_at">;

export type SubmissionStatus = "pending" | "reviewing" | "approved" | "rejected" | "duplicate";

export type PlaceSubmissionRecord = {
  id: string;
  user_id: string | null;
  place_id?: string | null;
  locale: "zh" | "en" | "ja" | "ko";
  name?: string | null;
  category?: PlaceCategory | null;
  provider: PlaceSourceProvider;
  external_id?: string | null;
  source_url?: string | null;
  address_text?: string | null;
  location_text?: string | null;
  recommendation_reason?: string | null;
  notes: string;
  status: SubmissionStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaceListResult = {
  places: PlaceWithRelations[];
  source: "supabase" | "demo";
  error?: string;
};

export type PhotoSpotRecord = {
  id: string;
  slug: string;
  name_zh: string;
  name_ko: string;
  latitude: number | null;
  longitude: number | null;
  best_time: string;
  camera_position: string;
  subject_position: string;
  recommended_zoom: string;
  portrait_tip_zh: string;
  lighting_tip_zh: string;
  thumbnail_url: string;
  sample_image_url: string;
  free_or_pro: "free" | "pro";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PhotoSpotListResult = {
  photoSpots: PhotoSpotRecord[];
  source: "supabase" | "demo";
  error?: string;
};

export const categoryLabels: Record<PlaceCategory, { zh: string; en: string; ja: string; ko: string }> = {
  restaurant: { zh: "餐厅", en: "Restaurants", ja: "飲食店", ko: "음식점" },
  cafe: { zh: "咖啡", en: "Cafes", ja: "カフェ", ko: "카페" },
  bar: { zh: "酒吧", en: "Bars", ja: "バー", ko: "술집" },
  attraction: { zh: "景点", en: "Attractions", ja: "観光", ko: "관광" },
  shopping: { zh: "购物", en: "Shopping", ja: "ショッピング", ko: "쇼핑" },
  photo_spot: { zh: "拍照", en: "Photo spots", ja: "写真スポット", ko: "사진" },
  luggage: { zh: "行李寄存", en: "Luggage", ja: "荷物預かり", ko: "짐보관" },
};
