import { googleMapsProvider } from "@/lib/place-providers/google";
import { kakaoMapsProvider } from "@/lib/place-providers/kakao";
import { naverMapsProvider } from "@/lib/place-providers/naver";
import type { PlaceProvider, SupportedPlaceProvider } from "@/lib/place-providers/types";

const providers: Record<SupportedPlaceProvider, PlaceProvider> = {
  google: googleMapsProvider,
  naver: naverMapsProvider,
  kakao: kakaoMapsProvider,
};

export function getPlaceProvider(provider: SupportedPlaceProvider) {
  return providers[provider];
}

export function listPlaceProviders() {
  return Object.values(providers);
}
