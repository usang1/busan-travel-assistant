import type { NormalizedPlace, SupportedPlaceProvider } from "@/lib/place-providers/types";

export type PlaceCapabilityField =
  | "name"
  | "category"
  | "address"
  | "coordinates"
  | "phone"
  | "website"
  | "openingHours"
  | "rating"
  | "reviewCount"
  | "priceLevel"
  | "photos"
  | "providerPlaceId"
  | "sourceUrl";

export type PlaceCapability = {
  field: PlaceCapabilityField;
  label: string;
};

const labels: Record<PlaceCapabilityField, string> = {
  name: "장소명",
  category: "카테고리",
  address: "주소",
  coordinates: "좌표",
  phone: "전화번호",
  website: "홈페이지",
  openingHours: "영업시간",
  rating: "평점",
  reviewCount: "리뷰 수",
  priceLevel: "가격대",
  photos: "사진",
  providerPlaceId: "Place ID",
  sourceUrl: "원본 링크",
};

const capabilities: Record<SupportedPlaceProvider, readonly PlaceCapabilityField[]> = {
  google: [
    "name",
    "category",
    "address",
    "coordinates",
    "phone",
    "website",
    "openingHours",
    "rating",
    "reviewCount",
    "priceLevel",
    "photos",
    "providerPlaceId",
    "sourceUrl",
  ],
  naver: ["name", "category", "address", "coordinates", "phone", "providerPlaceId", "sourceUrl"],
  kakao: ["name", "category", "address", "coordinates", "phone", "providerPlaceId", "sourceUrl"],
};

export const providerWarningLabels: Record<string, string> = {
  provider_credentials_missing: "상세 검색 인증 정보 없음",
  photos_not_supported: "사진 정보 없음",
  price_not_supported: "가격대 정보 없음",
  opening_hours_not_supported: "영업시간 정보 없음",
  rating_not_supported: "평점 정보 없음",
  review_count_not_supported: "리뷰 수 정보 없음",
  website_not_supported: "홈페이지 정보 없음",
};

export function getProviderCapabilities(provider: SupportedPlaceProvider): PlaceCapability[] {
  return capabilities[provider].map((field) => ({ field, label: labels[field] }));
}

export function getProviderUnavailableCapabilities(
  provider: SupportedPlaceProvider,
  place: Pick<NormalizedPlace, "name" | "category" | "addressKo" | "roadAddressKo" | "formattedAddress" | "latitude" | "longitude" | "phone" | "website" | "openingHours" | "currentOpeningHours" | "rating" | "reviewCount" | "priceLevel" | "photos" | "providerPlaceId" | "sourceUrl">,
) {
  const available: Record<PlaceCapabilityField, boolean> = {
    name: Boolean(place.name?.trim()),
    category: Boolean(place.category?.trim()),
    address: Boolean((place.roadAddressKo ?? place.addressKo ?? place.formattedAddress)?.trim()),
    coordinates: place.latitude !== undefined && place.longitude !== undefined,
    phone: Boolean(place.phone?.trim()),
    website: Boolean(place.website?.trim()),
    openingHours: Boolean(place.openingHours || place.currentOpeningHours),
    rating: place.rating !== undefined,
    reviewCount: place.reviewCount !== undefined,
    priceLevel: place.priceLevel !== undefined,
    photos: Boolean(place.photos?.some((photo) => photo.url)),
    providerPlaceId: Boolean(place.providerPlaceId?.trim()),
    sourceUrl: Boolean(place.sourceUrl?.trim()),
  };

  return getProviderCapabilities(provider).filter(({ field }) => !available[field]);
}

export function formatProviderWarnings(warnings: string[] | undefined) {
  return Array.from(new Set((warnings ?? []).map((warning) => providerWarningLabels[warning] ?? warning).filter(Boolean)));
}

export function toSupportedProvider(value: string | undefined): SupportedPlaceProvider | null {
  const normalized = value?.toLowerCase();
  return normalized === "google" || normalized === "naver" || normalized === "kakao" ? normalized : null;
}
