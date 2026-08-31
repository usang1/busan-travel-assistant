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

export function getPlaceProviderConfiguration(provider: SupportedPlaceProvider) {
  if (provider === "google") {
    const configured = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
    return {
      configured,
      missingEnvironmentVariables: configured ? [] : ["GOOGLE_MAPS_API_KEY"],
    };
  }

  if (provider === "naver") {
    const apiHubConfigured = Boolean(
      process.env.NAVER_API_HUB_CLIENT_ID?.trim() && process.env.NAVER_API_HUB_CLIENT_SECRET?.trim(),
    );
    const legacyConfigured = Boolean(
      process.env.NAVER_SEARCH_CLIENT_ID?.trim() && process.env.NAVER_SEARCH_CLIENT_SECRET?.trim(),
    );
    return {
      configured: apiHubConfigured || legacyConfigured,
      missingEnvironmentVariables: apiHubConfigured || legacyConfigured
        ? []
        : ["NAVER_API_HUB_CLIENT_ID", "NAVER_API_HUB_CLIENT_SECRET"],
    };
  }

  const configured = Boolean(process.env.KAKAO_REST_API_KEY?.trim());
  return {
    configured,
    missingEnvironmentVariables: configured ? [] : ["KAKAO_REST_API_KEY"],
  };
}
