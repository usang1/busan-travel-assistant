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

export type PlaceWithRelations = PlaceRecord & {
  tags: TagRecord[];
  menu_items: PlaceMenuItem[];
  translations?: PlaceTranslationRecord[];
};

export type PlacePayload = Omit<PlaceRecord, "id" | "created_at" | "updated_at"> & {
  tags: Array<Pick<TagRecord, "label_zh" | "label_ko" | "slug">>;
  menu_items: Array<Omit<PlaceMenuItem, "id" | "place_id">>;
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
