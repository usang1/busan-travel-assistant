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

export type MapProviderId = "naver" | "fallback";

export type TravelMapProvider = {
  id: MapProviderId;
  label: string;
  requiresApiKey: boolean;
};

export const mapProviders: Record<MapProviderId, TravelMapProvider> = {
  naver: {
    id: "naver",
    label: "Naver Maps",
    requiresApiKey: true,
  },
  fallback: {
    id: "fallback",
    label: "Fallback coordinate map",
    requiresApiKey: false,
  },
};

export function getPreferredMapProvider(): TravelMapProvider {
  if (process.env.NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID) {
    return mapProviders.naver;
  }

  return mapProviders.fallback;
}
