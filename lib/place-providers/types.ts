import type { ParsedMapUrl } from "@/lib/map-url";

export type SupportedPlaceProvider = "google" | "naver" | "kakao";
export type DetectedPlaceProvider = SupportedPlaceProvider | "unknown";

export type NormalizedPlacePhoto = {
  reference?: string;
  url?: string;
  attribution?: string;
  width?: number;
  height?: number;
  persistence: "preview_only" | "persistent";
  fetchedAt?: string;
};

export type NormalizedPlace = {
  provider: SupportedPlaceProvider;
  providerPlaceId?: string;
  sourceUrl: string;
  finalResolvedUrl?: string;
  name?: string;
  category?: string;
  types?: string[];
  description?: string;
  addressKo?: string;
  roadAddressKo?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  providerUri?: string;
  openingHours?: string | string[];
  currentOpeningHours?: string | string[];
  imageUrl?: string;
  primaryImageUrl?: string;
  photos?: NormalizedPlacePhoto[];
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  priceMin?: number;
  priceMax?: number;
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  amenities?: {
    parking?: boolean;
    reservable?: boolean;
    takeout?: boolean;
    restroom?: boolean;
  };
  nearestStation?: string;
  nearestStationDistanceMeters?: number;
  nearestStationWalkingMinutes?: number;
  providerWarnings?: string[];
  fetchedAt?: string;
  raw?: unknown;
};

export type PlaceProviderLookupContext = {
  sourceUrl: string;
  finalResolvedUrl: string;
  parsedUrls: ParsedMapUrl[];
  fetcher: typeof fetch;
};

export interface PlaceProvider {
  readonly id: SupportedPlaceProvider;
  lookup(context: PlaceProviderLookupContext): Promise<Partial<NormalizedPlace> | null>;
}
