import { cache } from "react";
import { getPublishedGuides } from "@/lib/guide-store";
import { type Locale } from "@/lib/i18n";
import { getPhotoSpots } from "@/lib/photo-spot-store";
import { getPlaces } from "@/lib/place-store";
import { translatedGuideLocales } from "@/lib/public-seo";

export const getPublishedGuidesForLocale = cache(async (locale: Locale) => {
  const result = await getPublishedGuides();
  return {
    ...result,
    guides: result.guides.filter((guide) => translatedGuideLocales(guide).includes(locale)),
  };
});

export const getPhotoSpotContentState = cache(async () => {
  const result = await getPhotoSpots();
  return {
    ...result,
    hasPublicContent: result.photoSpots.length > 0,
  };
});

export const getLuggageContentState = cache(async (locale: Locale) => {
  const result = await getPlaces({ activeOnly: true, locale, debugLabel: "luggage-content-state" });
  const luggagePlaces = result.places.filter((place) => place.category === "luggage");

  return {
    ...result,
    places: luggagePlaces,
    hasPublicContent: luggagePlaces.length > 0,
  };
});
