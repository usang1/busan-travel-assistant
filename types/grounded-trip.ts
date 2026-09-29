import type { Locale } from "@/lib/i18n";
import type { PlaceCategory } from "@/types/database";
import type { PlaceCity } from "@/lib/city-regions";

export type GroundedTravelType = "solo" | "couple" | "parents" | "friends";
export type GroundedWalkingPreference = "low" | "normal" | "high";
export type GroundedWeather = "dry" | "rain" | "snow";
export type GroundedPlanMode = "plan" | "recover";

export type GroundedLocation = {
  label: string;
  city_code: PlaceCity;
  district_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type GroundedTripConditions = {
  current_location: GroundedLocation;
  available_minutes: number;
  party_size: number;
  travel_type: GroundedTravelType;
  budget: number | null;
  desired_food: string[];
  excluded_food: string[];
  walking_preference: GroundedWalkingPreference;
  weather: GroundedWeather;
  start_time: string;
  end_time: string;
  must_visit_places: string[];
  saved_places: string[];
  language: Locale;
  accessibility_requirements: string[];
  luggage: boolean;
  desired_finish_location: GroundedLocation | null;
};

export type ExistingItineraryStop = {
  place_id: string;
  planned_time: string | null;
  stay_minutes: number | null;
};

export type GroundedTripRequest = {
  mode: GroundedPlanMode;
  request_text: string;
  conditions: GroundedTripConditions;
  existing_itinerary: ExistingItineraryStop[];
};

export type GroundedPlanPlace = {
  id: string;
  slug: string;
  name: string;
  korean_name: string;
  address: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  thumbnail_url: string;
  arrival_time: string;
  stay_minutes: number;
  travel_minutes: number;
  travel_mode: "walk" | "transit" | "taxi";
  distance_meters: number | null;
  open_status: string;
  open_status_code: string;
  recommendation_reason: string;
  matched_conditions: string[];
  warnings: string[];
  alternative_place_ids: string[];
  alternative_places: Array<{ id: string; slug: string; name: string }>;
  confidence: "high" | "medium" | "low";
  unresolved_conditions: string[];
  last_verified_at: string | null;
  verification_status: string;
  estimated_cost: { min: number; max: number } | null;
  menu_guidance: {
    items: Array<{ korean_name: string; localized_name: string; quantity: number; price: number | null }>;
    total: number | null;
    warnings: string[];
    korean_order_text: string;
  } | null;
};

export type GroundedRecoveryChange = {
  from_place_id: string;
  to_place_id: string | null;
  reason_codes: string[];
};

export type GroundedTripPlan = {
  route_title: string;
  total_duration: number;
  total_cost_range: { min: number; max: number; currency: "KRW"; complete: boolean } | null;
  total_walking_time: number;
  places: GroundedPlanPlace[];
  confidence: "high" | "medium" | "low";
  unresolved_conditions: string[];
  source: "rules" | "ai_ordered";
  generated_at: string;
  conditions: GroundedTripConditions;
  recovery: {
    checked: boolean;
    issues: Array<{ place_id: string; reason_codes: string[] }>;
    changes: GroundedRecoveryChange[];
    before_place_ids: string[];
  };
};
