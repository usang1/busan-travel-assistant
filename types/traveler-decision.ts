import type { PlaceFactTristate } from "@/types/database";

export const travelerThemes = [
  "first_trip", "solo", "couple", "parents", "rainy_day", "food_trip",
  "photo_trip", "cafe_trip", "night_view", "low_walking", "luggage_day", "late_night",
  "two_nights_three_days", "gwangalli_half_day", "haeundae_three_hours",
] as const;

export type TravelerTheme = (typeof travelerThemes)[number];
export type TravelerVerificationStatus = "verified" | "partially_verified" | "unverified" | "stale" | "conflicting" | "rejected";
export type PlaceFactSourceType = "official_source" | "owner_merchant" | "administrator" | "traveler_report" | "inferred" | "unverified";
export type WorthDetourLevel = "nearby_only" | "worth_short_detour" | "worth_long_detour" | "destination";
export type PlaceTravelMode = "walk" | "transit" | "taxi" | "car" | "mixed";
export type LocaleText = { ko: string; zh: string; en: string; ja: string };

export type PlaceDecisionProfile = {
  place_id?: string;
  tourist_fit_score: number | null;
  recommended_for: TravelerTheme[];
  not_recommended_for: TravelerTheme[];
  primary_warning: LocaleText;
  visit_summary: LocaleText;
  worth_detour_level: WorthDetourLevel | null;
  order_difficulty: number | null;
  solo_difficulty: number | null;
  foreigner_difficulty: number | null;
  confidence_score: number | null;
  evidence_count: number;
  last_verified_at: string | null;
  verification_status: TravelerVerificationStatus;
  updated_at?: string;
};

export type KioskLanguageSupport = {
  status: PlaceFactTristate;
  languages: string[];
};

export type PlacePracticalProfile = {
  spicy_level: number | null;
  oily_level: number | null;
  aroma_level: number | null;
  sweetness_level: number | null;
  portion_level: number | null;
  taste_notes: LocaleText;
  foreign_card: PlaceFactTristate;
  alipay: PlaceFactTristate;
  wechat_pay: PlaceFactTristate;
  chinese_menu: PlaceFactTristate;
  english_menu: PlaceFactTristate;
  kiosk_language_support: KioskLanguageSupport;
  solo_friendly: PlaceFactTristate;
  luggage_friendly: PlaceFactTristate;
  luggage_storage: PlaceFactTristate;
  restroom: PlaceFactTristate;
  restroom_location_note: string;
  reservation_required: PlaceFactTristate;
  minimum_order_amount: number | null;
  minimum_order_people: number | null;
  wheelchair_access: PlaceFactTristate;
  elevator: PlaceFactTristate;
  stroller_friendly: PlaceFactTristate;
  power_outlet: PlaceFactTristate;
  wifi: PlaceFactTristate;
  smoking_policy: "non_smoking" | "smoking_area" | "smoking_allowed" | null;
  queue_available: PlaceFactTristate;
  queue_method: string;
};

export type TimeRange = {
  weekdays: number[];
  start: string;
  end: string;
  note?: string;
};

export type TemporaryClosure = { start_date: string; end_date: string; reason: string };
export type StructuredOperatingDay = { weekday: number; open: string; close: string; closed: boolean; overnight: boolean };

export type PlaceOperatingProfile = {
  timezone: "Asia/Seoul";
  structured_operating_hours: StructuredOperatingDay[];
  last_order_time: string | null;
  temporary_closures: TemporaryClosure[];
  recommended_time_ranges: TimeRange[];
  avoid_time_ranges: TimeRange[];
  wait_time_by_weekday_hour: Record<string, number | null>;
  sellout_risk_by_hour: Record<string, number | null>;
  photo_time_ranges: TimeRange[];
  seasonal_availability: Array<{ start_month: number; end_month: number; note: string }>;
  holiday_notes: LocaleText;
  verification_status: TravelerVerificationStatus;
  last_verified_at: string | null;
  updated_at?: string;
};

export type TravelerMenuItem = {
  id?: string;
  localized_name: LocaleText;
  korean_original_name: string;
  price: number | null;
  recommendation_status: PlaceFactTristate;
  recommendation_basis: string;
  spicy_level: number | null;
  oily_level: number | null;
  aroma_level: number | null;
  portion_size: number | null;
  recommended_party_size: number | null;
  contains_seafood: PlaceFactTristate;
  contains_cilantro: PlaceFactTristate;
  meal_type: "meal" | "snack" | "both" | null;
  ordering_note: LocaleText;
  menu_warning: LocaleText;
  availability_time: TimeRange[];
  sold_out_risk: number | null;
  sort_order: number;
};

export type PlaceFactEvidence = {
  id?: string;
  field_key: string;
  fact_value: unknown;
  source_type: PlaceFactSourceType;
  source_label: string;
  source_url: string;
  observed_at: string | null;
  verified_at: string | null;
  verification_status: TravelerVerificationStatus;
  notes: string;
};

export type PlaceConnection = {
  id?: string;
  from_place_id?: string;
  to_place_id: string;
  travel_minutes: number | null;
  travel_distance: number | null;
  travel_mode: PlaceTravelMode | null;
  sequence_reason: LocaleText;
  valid_time_ranges: TimeRange[];
  weather_conditions: string[];
  trip_theme: TravelerTheme[];
  active: boolean;
  priority: number;
};

export type TravelerDecisionBundle = {
  decision: PlaceDecisionProfile;
  practical: PlacePracticalProfile;
  operating: PlaceOperatingProfile;
  menus: TravelerMenuItem[];
  evidence: PlaceFactEvidence[];
  connections: PlaceConnection[];
};

export type TravelerDecisionSection = keyof TravelerDecisionBundle;

export type TravelerModerationStatus = "pending" | "approved" | "rejected" | "needs_review";
export type TravelerVerificationMethod = "authenticated" | "location" | "receipt" | "photo" | "manual";

export type PlaceCheckinRecord = {
  id: string;
  place_id: string;
  user_id: string | null;
  device_hash: string | null;
  observed_at: string;
  locale: "ko" | "zh" | "en" | "ja";
  verification_method: TravelerVerificationMethod;
  moderation_status: TravelerModerationStatus;
  risk_flags: string[];
  created_at: string;
};

export type PlaceFactReportRecord = {
  id: string;
  checkin_id: string | null;
  place_id: string;
  fact_type: string;
  fact_value: unknown;
  observed_at: string;
  created_at: string;
  locale: "ko" | "zh" | "en" | "ja";
  user_id: string | null;
  device_hash: string | null;
  verification_method: TravelerVerificationMethod;
  moderation_status: TravelerModerationStatus;
  trust_weight: number | null;
  moderator_id: string | null;
  moderated_at: string | null;
  flagged_at: string | null;
  flag_reason: string | null;
  review_notes: string | null;
};
