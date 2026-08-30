import type { ParsedMapUrl } from "@/lib/map-url";

export type SupportedPlaceProvider = "google" | "naver" | "kakao";
export type DetectedPlaceProvider = SupportedPlaceProvider | "unknown";

export type NormalizedPlace = {
  provider: SupportedPlaceProvider;
  providerPlaceId?: string;
  sourceUrl: string;
  finalResolvedUrl?: string;
  name?: string;
  category?: string;
  addressKo?: string;
  roadAddressKo?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  openingHours?: string | string[];
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
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
