import type { Coordinates } from "@/lib/location";
import type { PlaceCategory } from "@/types/database";

export type MapMarker = {
  id: string;
  title: string;
  subtitle: string;
  category: PlaceCategory;
  position: Coordinates;
  href: string;
  imageUrl: string;
  meta: string;
  saveCount?: number;
};

export type MapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type MapProviderId = "kakao" | "fallback";

export type TravelMapProvider = {
  id: MapProviderId;
  label: string;
  requiresApiKey: boolean;
};

export const mapProviders: Record<MapProviderId, TravelMapProvider> = {
  kakao: {
    id: "kakao",
    label: "Kakao Maps",
    requiresApiKey: true,
  },
  fallback: {
    id: "fallback",
    label: "Fallback coordinate map",
    requiresApiKey: false,
  },
};

export function getPreferredMapProvider(): TravelMapProvider {
  if (process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY) {
    return mapProviders.kakao;
  }

  return mapProviders.fallback;
}
