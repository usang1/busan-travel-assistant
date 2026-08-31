import { normalizeCoordinates } from "@/lib/place-providers/normalize";
import { sanitizeLocalizedAddress } from "@/lib/place-ai/locale-validation";
import type { NormalizedPlace } from "@/lib/place-providers/types";
import type { PlaceCategory, PlacePayload, PlaceSourceProvider } from "@/types/database";

export type EnrichablePlaceForm = {
  source_url: string;
  provider: PlaceSourceProvider;
  source_external_id: string;
  name_ko: string;
  name_zh: string;
  category: PlaceCategory | "";
  address_ko: string;
  address_zh: string;
  address_en: string;
  address_ja: string;
  latitude: string;
  longitude: string;
  phone: string;
  website: string;
  opening_hours: string;
  price_level: string;
  price_min: string;
  price_max: string;
  thumbnail_url: string;
  provider_image_preview_url: string;
  provider_image_attribution: string;
  nearest_station: string;
  walking_minutes: string;
  provider_rating: string;
  provider_review_count: string;
  provider_amenities: string;
  source_metadata: Record<string, unknown> | null;
  source_fetched_at: string;
};

export function enrichPlaceForm<T extends EnrichablePlaceForm>(form: T, place: NormalizedPlace): T {
  const coordinates = normalizeCoordinates(place.latitude, place.longitude);
  const providerCategory = mapProviderCategory([place.category, ...(place.types ?? [])].filter(Boolean).join(">"));
  const providerHours = place.openingHours ?? place.currentOpeningHours;
  const openingHours = Array.isArray(providerHours) ? providerHours.join("\n") : providerHours;
  const sourceProvider = toSourceProvider(place.provider);
  const sameSource = isSameProviderSource(form, sourceProvider, place.providerPlaceId);
  const addressKo = place.roadAddressKo ?? place.addressKo ?? "";
  const providerAddressEn = sanitizeLocalizedAddress(place.formattedAddress, addressKo, "en");
  const persistentImage = place.photos?.find((photo) => photo.persistence === "persistent" && photo.url)?.url;
  const previewPhoto = place.photos?.find((photo) => photo.url);
  const previewImage = previewPhoto?.url ?? place.primaryImageUrl ?? place.imageUrl ?? "";

  return {
    ...form,
    source_url: place.sourceUrl || form.source_url,
    provider: sourceProvider,
    source_external_id: place.providerPlaceId ?? (sameSource ? form.source_external_id : ""),
    name_ko: fillText(form.name_ko, place.name),
    category: form.category || providerCategory || "",
    address_ko: fillText(form.address_ko, addressKo || place.formattedAddress),
    address_en: fillText(form.address_en, providerAddressEn),
    latitude: coordinates && !hasValidFormCoordinates(form) ? coordinates.latitude.toFixed(7) : form.latitude,
    longitude: coordinates && !hasValidFormCoordinates(form) ? coordinates.longitude.toFixed(7) : form.longitude,
    phone: fillText(form.phone, place.phone),
    website: fillText(form.website, place.website),
    opening_hours: fillText(form.opening_hours, openingHours),
    price_level: fillNumber(form.price_level, place.priceLevel),
    price_min: fillNumber(form.price_min, place.priceMin),
    price_max: fillNumber(form.price_max, place.priceMax),
    thumbnail_url: fillText(form.thumbnail_url, persistentImage),
    provider_image_preview_url: refreshText(form.provider_image_preview_url, previewImage, sameSource),
    provider_image_attribution: refreshText(form.provider_image_attribution, previewPhoto?.attribution ?? "", sameSource),
    nearest_station: fillText(form.nearest_station, place.nearestStation),
    walking_minutes: fillNumber(form.walking_minutes, place.nearestStationWalkingMinutes),
    provider_rating: refreshNumber(form.provider_rating, place.rating, sameSource),
    provider_review_count: refreshNumber(form.provider_review_count, place.reviewCount, sameSource),
    provider_amenities: refreshText(form.provider_amenities, formatProviderAmenities(place.amenities), sameSource),
    source_metadata: buildSourceMetadata(place, sameSource ? form.source_metadata : null),
    source_fetched_at: place.fetchedAt ?? new Date().toISOString(),
  };
}

export function mapProviderCategory(value?: string): PlaceCategory | undefined {
  const category = value?.toLowerCase().trim();
  if (!category) return undefined;

  if (matches(category, ["cafe", "coffee", "bakery", "카페", "커피", "베이커리"])) return "cafe";
  if (matches(category, ["bar", "pub", "night club", "주점", "술집", "호프", "와인바"])) return "bar";
  if (matches(category, ["restaurant", "food", "meal", "음식점", "식당", "한식", "중식", "일식", "분식", "육류"])) return "restaurant";
  if (matches(category, ["shopping", "store", "market", "mall", "쇼핑", "상점", "마트", "백화점", "시장"])) return "shopping";
  if (matches(category, ["luggage", "storage", "locker", "짐보관", "물품보관"])) return "luggage";
  if (matches(category, ["photo spot", "전망대", "포토", "사진"])) return "photo_spot";
  if (matches(category, ["tourist", "attraction", "museum", "park", "beach", "landmark", "관광", "명소", "박물관", "공원", "해변", "해수욕장"])) return "attraction";
  return undefined;
}

export function hasValidFormCoordinates(form: Pick<EnrichablePlaceForm, "latitude" | "longitude">) {
  return Boolean(normalizeCoordinates(form.latitude, form.longitude));
}

export function buildSourceMetadata(place: NormalizedPlace, existing: Record<string, unknown> | null = null) {
  const incoming = {
    provider_place_id: place.providerPlaceId ?? null,
    final_resolved_url: place.finalResolvedUrl ?? null,
    category: place.category ?? null,
    types: place.types ?? null,
    provider_description: place.description ?? null,
    provider_uri: place.providerUri ?? null,
    rating: place.rating ?? null,
    review_count: place.reviewCount ?? null,
    price_level: place.priceLevel ?? null,
    price_range: place.priceRange ?? null,
    photo_count: place.photos?.length ?? 0,
    provider_photo_preview_only: place.photos?.some((photo) => photo.persistence === "preview_only") ?? false,
    amenities: place.amenities ?? null,
    nearest_station: place.nearestStation ?? null,
    nearest_station_distance_meters: place.nearestStationDistanceMeters ?? null,
    provider_warnings: place.providerWarnings ?? null,
    raw: place.raw ?? null,
  };

  return {
    ...(existing ?? {}),
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== null && value !== undefined)),
  };
}

export function buildPlaceSourcePayload(form: EnrichablePlaceForm): PlacePayload["source"] {
  const sourceUrl = form.source_url.trim();
  if (!sourceUrl) return undefined;

  return {
    provider: form.provider,
    source_url: sourceUrl,
    external_id: form.source_external_id.trim() || null,
    raw_metadata: form.source_metadata,
    last_synced_at: form.source_fetched_at || null,
  };
}

export function formatProviderAmenities(value: NormalizedPlace["amenities"] | unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const amenities = value as NonNullable<NormalizedPlace["amenities"]>;
  const labels = [
    formatBooleanFact("주차", amenities.parking),
    formatBooleanFact("예약 지원", amenities.reservable),
    formatBooleanFact("포장", amenities.takeout),
    formatBooleanFact("화장실", amenities.restroom),
  ].filter(Boolean);
  return labels.join(" · ");
}

function fillText(current: string, incoming?: string) {
  return current.trim() || !incoming?.trim() ? current : incoming.trim();
}

function fillNumber(current: string, incoming?: number) {
  return current.trim() || incoming === undefined || !Number.isFinite(incoming) ? current : String(incoming);
}

function refreshNumber(current: string, incoming: number | undefined, sameSource: boolean) {
  return incoming !== undefined && Number.isFinite(incoming) ? String(incoming) : sameSource ? current : "";
}

function refreshText(current: string, incoming: string, sameSource: boolean) {
  return incoming.trim() ? incoming : sameSource ? current : "";
}

function matches(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function toSourceProvider(provider: NormalizedPlace["provider"]): PlaceSourceProvider {
  if (provider === "google") return "GOOGLE";
  if (provider === "naver") return "NAVER";
  return "KAKAO";
}

function isSameProviderSource(form: EnrichablePlaceForm, provider: PlaceSourceProvider, providerPlaceId?: string) {
  if (form.provider !== provider) return false;
  if (providerPlaceId) return form.source_external_id === providerPlaceId;
  return !form.source_external_id;
}

function formatBooleanFact(label: string, value?: boolean) {
  if (value === undefined) return "";
  return `${label}: ${value ? "가능" : "불가"}`;
}
