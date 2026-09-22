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

export type PlaceVerificationBasis = "official_source" | "admin" | "traveler" | "unverified";

export type PlaceCityCode = "busan" | "seoul" | "jeju";

export const placeWorkflowStatuses = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;

export type PlaceWorkflowStatus = (typeof placeWorkflowStatuses)[number];

export type LegacyPlaceStatus = "ACTIVE" | "INACTIVE";

export type PlaceStatus = PlaceWorkflowStatus | LegacyPlaceStatus;

export type TravelerInsightOrderingMethod = "unknown" | "kiosk" | "staff" | "both";

export type TravelerInsightReservation = "unknown" | "not_needed" | "recommended" | "required";

export type TravelerInsightWaiting = "unknown" | "none" | "some" | "high";

export type TravelerInsightToilet = "unknown" | "available" | "inside" | "none";

export type TravelerInsightIntensity = "unknown" | "normal" | "strong";

export type TravelerInsightPossibility = "unknown" | "no" | "possible";

export type TravelerInsightPortion = "unknown" | "regular" | "large";

export type TravelerInsights = {
  solo_dining?: PlaceFactTristate;
  card_payment?: PlaceFactTristate;
  cash_required?: PlaceFactTristate;
  chinese_menu?: PlaceFactTristate;
  english_menu?: PlaceFactTristate;
  ordering_method?: TravelerInsightOrderingMethod;
  reservation?: TravelerInsightReservation;
  waiting?: TravelerInsightWaiting;
  luggage_storage?: PlaceFactTristate;
  toilet?: TravelerInsightToilet;
  spicy?: TravelerInsightIntensity;
  cilantro?: TravelerInsightPossibility;
  spice_intensity?: TravelerInsightIntensity;
  portion?: TravelerInsightPortion;
  greasiness?: TravelerInsightPossibility;
  tourist_friendly?: PlaceFactTristate;
};

export type PlaceRecord = {
  id: string;
  slug: string;
  name_zh: string;
  name_ko: string;
  category: PlaceCategory;
  city_code?: PlaceCityCode | null;
  district_code?: string | null;
  address?: string;
  short_description_zh: string;
  short_description_ko: string;
  admin_summary: string;
  address_ko: string;
  address_zh: string;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  website?: string | null;
  price_level?: number | null;
  status?: PlaceStatus;
  closed_days?: string;
  last_verified_at?: string | null;
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
  address: string;
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
  localized_name?: { ko: string; zh: string; en: string; ja: string };
  korean_original_name?: string;
  recommendation_status?: PlaceFactTristate;
  recommendation_basis?: string | null;
  spicy_level?: number | null;
  oily_level?: number | null;
  aroma_level?: number | null;
  portion_size?: number | null;
  recommended_party_size?: number | null;
  contains_seafood?: PlaceFactTristate;
  contains_cilantro?: PlaceFactTristate;
  meal_type?: "meal" | "snack" | "both" | null;
  ordering_note?: { ko: string; zh: string; en: string; ja: string };
  menu_warning?: { ko: string; zh: string; en: string; ja: string };
  availability_time?: Array<{ weekdays: number[]; start: string; end: string; note?: string }>;
  sold_out_risk?: number | null;
};

export type PlaceChinaInfoRecord = {
  id: string;
  place_id: string;
  chinese_taste_score: number | null;
  spicy_level: number | null;
  greasy_level: number | null;
  smell_level: number | null;
  sweetness_level?: number | null;
  portion_level: number | null;
  ordering_difficulty: number | null;
  waiting_level: ChinaWaitingLevel;
  waiting_minutes_min: number | null;
  waiting_minutes_max: number | null;
  chinese_menu: PlaceFactTristate;
  chinese_service?: PlaceFactTristate;
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
  minimum_order_amount?: number | null;
  taste_notes_zh?: string | null;
  taste_notes_ko?: string | null;
  taste_notes_en?: string | null;
  taste_notes_ja?: string | null;
  kiosk_language_support?: { status: PlaceFactTristate; languages: string[] } | null;
  restroom_location_note?: string | null;
  wheelchair_access?: PlaceFactTristate;
  elevator?: PlaceFactTristate;
  stroller_friendly?: PlaceFactTristate;
  power_outlet?: PlaceFactTristate;
  wifi?: PlaceFactTristate;
  smoking_policy?: "non_smoking" | "smoking_area" | "smoking_allowed" | null;
  queue_available?: PlaceFactTristate;
  queue_method?: string | null;
  xiaohongshu_popular: PlaceFactTristate;
  photo_recommended: PlaceFactTristate;
  tourism_recommended: PlaceFactTristate;
  subway_walk_minutes: number | null;
  manual_summary_override?: string | null;
  manual_warning_override?: string | null;
  traveler_insights?: TravelerInsights | null;
  verification_status: PlaceVerificationStatus;
  verification_basis?: PlaceVerificationBasis;
  traveler_confirmation_count?: number;
  has_information_conflict?: boolean;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaceDecisionProfileRecord = {
  place_id: string;
  tourist_fit_score: number | null;
  recommended_for: string[];
  not_recommended_for: string[];
  primary_warning: Partial<Record<"ko" | "zh" | "en" | "ja", string>>;
  visit_summary: Partial<Record<"ko" | "zh" | "en" | "ja", string>>;
  worth_detour_level: "nearby_only" | "worth_short_detour" | "worth_long_detour" | "destination" | null;
  solo_difficulty: number | null;
  foreigner_difficulty: number | null;
  confidence_score: number | null;
  evidence_count: number;
  last_verified_at: string | null;
  verification_status: "verified" | "partially_verified" | "unverified" | "stale" | "conflicting" | "rejected";
  created_at?: string;
  updated_at?: string;
};

export type PlaceOperatingProfileRecord = {
  place_id: string;
  timezone: "Asia/Seoul";
  structured_operating_hours: Array<{ weekday: number; open: string; close: string; closed: boolean; overnight: boolean }>;
  last_order_time: string | null;
  temporary_closures: Array<{ start_date: string; end_date: string; reason: string }>;
  recommended_time_ranges: Array<{ weekdays: number[]; start: string; end: string; note?: string }>;
  avoid_time_ranges: Array<{ weekdays: number[]; start: string; end: string; note?: string }>;
  wait_time_by_weekday_hour: Record<string, number | null>;
  sellout_risk_by_hour: Record<string, number | null>;
  photo_time_ranges: Array<{ weekdays: number[]; start: string; end: string; note?: string }>;
  seasonal_availability: Array<{ start_month: number; end_month: number; note: string }>;
  holiday_notes: Partial<Record<"ko" | "zh" | "en" | "ja", string>>;
  verification_status: "verified" | "partially_verified" | "unverified" | "stale" | "conflicting" | "rejected";
  last_verified_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PlaceWithRelations = PlaceRecord & {
  tags: TagRecord[];
  menu_items: PlaceMenuItem[];
  translations?: PlaceTranslationRecord[];
  sources?: PlaceSourceRecord[];
  china_info?: PlaceChinaInfoRecord | null;
  decision_profile?: PlaceDecisionProfileRecord | null;
  operating_profile?: PlaceOperatingProfileRecord | null;
  save_count?: number;
  recent_save_count?: number;
  recommendation_distance?: number;
};

export type PlaceRankingCollection = {
  popular: PlaceWithRelations[];
  trending: PlaceWithRelations[];
  error?: string;
};

export type TripVisibility = "private" | "unlisted";

export type TripRecord = {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  visibility: TripVisibility;
  share_slug: string;
  client_merge_key?: string | null;
  source_guide_id?: string | null;
  source_guide_updated_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TripPlaceRecord = {
  id: string;
  trip_id: string;
  place_id: string;
  day_number: number;
  sort_order: number;
  memo: string;
  planned_time: string | null;
  stay_minutes?: number | null;
  travel_minutes?: number | null;
  travel_mode?: "walk" | "transit" | "taxi" | "car" | "mixed" | null;
  source_guide_sequence?: number | null;
  created_at: string;
  updated_at: string;
};

export type TripPlaceWithPlace = TripPlaceRecord & {
  place: PlaceWithRelations;
};

export type TripWithPlaces = TripRecord & {
  trip_places: TripPlaceWithPlace[];
};

export type SharedTripWithPlaces = Omit<TripRecord, "user_id"> & {
  trip_places: TripPlaceWithPlace[];
};

export type PlaceSourceRecord = {
  id: string;
  place_id: string;
  provider: PlaceSourceProvider;
  external_id?: string | null;
  source_url?: string | null;
  last_synced_at?: string | null;
  raw_metadata?: Record<string, unknown> | null;
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
  | "guide_view"
  | "place_view"
  | "place_save"
  | "place_unsave"
  | "guide_save"
  | "guide_unsave"
  | "guide_place_click"
  | "saved_list_view"
  | "saved_map_view"
  | "marker_click"
  | "directions_click"
  | "share"
  | "share_click"
  | "submission_created"
  | "correction_submitted";

export type PlacePayload = Omit<PlaceRecord, "id" | "created_at" | "updated_at"> & {
  status: PlaceStatus;
  closed_days: string;
  last_verified_at?: string | null;
  tags: Array<Pick<TagRecord, "label_zh" | "label_ko" | "slug">>;
  menu_items: Array<Omit<PlaceMenuItem, "id" | "place_id"> & { id?: string }>;
  translations?: Array<Pick<PlaceTranslationRecord, "locale" | "name" | "description" | "travel_tip" | "address">>;
  source?: {
    provider: PlaceSourceProvider;
    source_url?: string | null;
    external_id?: string | null;
    raw_metadata?: Record<string, unknown> | null;
    last_synced_at?: string | null;
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
  source: "supabase" | "demo" | "none";
  candidateCount?: number;
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
  source: "supabase" | "demo" | "none";
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
