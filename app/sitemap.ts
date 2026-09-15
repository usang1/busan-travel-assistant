import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { localeAlternates, locales, withLocale } from "@/lib/i18n";
import { createPublicGuideClient } from "@/lib/guide-store";
import { getCachedPhotoSpots, getCachedPublishedGuides } from "@/lib/public-cache";
import { getPlaces } from "@/lib/place-store";
import { translatedGuideLocales, translatedPlaceLocales } from "@/lib/public-seo";

export const dynamic = "force-dynamic";

const routes = [
  "/",
  "/busan",
  "/places",
  "/nearby",
  "/translator",
  "/service-info",
  "/privacy",
  "/terms",
  "/contact",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const frequency = (route: string): MetadataRoute.Sitemap[number]["changeFrequency"] =>
    route === "/" ? "daily" : "weekly";
  const priority = (route: string) => (route === "/" ? 1 : 0.7);
  const [{ guides }, { photoSpots }] = await Promise.all([getCachedPublishedGuides(), getCachedPhotoSpots()]);
  const placeEntries: MetadataRoute.Sitemap = [];
  let hasLuggageContent = false;
  const client = createPublicGuideClient();
  if (client) {
    try {
      for (let from = 0; ; from += 500) {
        const result = await getPlaces({ activeOnly: true, range: { from, to: from + 499 } }, client);
        if (result.source !== "supabase" || result.error) break;
        for (const place of result.places) {
          if (place.category === "luggage") hasLuggageContent = true;
          const available = translatedPlaceLocales(place);
          for (const locale of available) placeEntries.push({
            url: absoluteUrl(withLocale(`/places/${place.slug}`, locale)),
            ...(Number.isFinite(Date.parse(place.updated_at)) ? { lastModified: new Date(place.updated_at) } : {}),
            changeFrequency: "weekly", priority: 0.8,
            alternates: { languages: localeAlternates(`/places/${place.slug}`, available) },
          });
        }
        if ((result.candidateCount ?? result.places.length) < 500) break;
      }
    } catch { /* Available public routes remain crawlable during a place-service outage. */ }
  }
  const staticEntries = routes.flatMap((route) =>
    locales.map((locale) => ({
      url: absoluteUrl(withLocale(route, locale)),
      changeFrequency: frequency(route),
      priority: priority(route),
      alternates: {
        languages: localeAlternates(route),
      },
    })),
  );
  const guideLandingLocales = locales.filter((locale) => guides.some((guide) => translatedGuideLocales(guide).includes(locale)));
  const guideLandingEntries = guideLandingLocales
    .map((locale) => ({
      url: absoluteUrl(withLocale("/guides", locale)),
      changeFrequency: frequency("/guides"),
      priority: priority("/guides"),
      alternates: {
        languages: localeAlternates("/guides", guideLandingLocales),
      },
    }));
  const photoSpotLandingEntries = photoSpots.length
    ? locales.map((locale) => ({
        url: absoluteUrl(withLocale("/photo-spots", locale)),
        changeFrequency: frequency("/photo-spots"),
        priority: priority("/photo-spots"),
        alternates: {
          languages: localeAlternates("/photo-spots"),
        },
      }))
    : [];
  const luggageLandingEntries = hasLuggageContent
    ? locales.map((locale) => ({
        url: absoluteUrl(withLocale("/luggage", locale)),
        changeFrequency: frequency("/luggage"),
        priority: priority("/luggage"),
        alternates: {
          languages: localeAlternates("/luggage"),
        },
      }))
    : [];
  const photoSpotEntries = photoSpots
    .filter((spot) => spot.is_active && spot.free_or_pro === "free" && spot.name_zh.trim())
    .map((spot) => ({
      url: absoluteUrl(withLocale(`/photo-spots/${spot.slug}`, "zh")),
      ...(Number.isFinite(Date.parse(spot.updated_at)) ? { lastModified: new Date(spot.updated_at) } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: { languages: localeAlternates(`/photo-spots/${spot.slug}`, ["zh"]) },
    }));
  return [...staticEntries, ...guideLandingEntries, ...photoSpotLandingEntries, ...luggageLandingEntries, ...placeEntries, ...photoSpotEntries, ...guides.flatMap((guide) => translatedGuideLocales(guide).map((locale) => ({
    url: absoluteUrl(withLocale(`/guides/${guide.slug}`, locale)),
    lastModified: new Date(guide.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
    alternates: { languages: localeAlternates(`/guides/${guide.slug}`, translatedGuideLocales(guide)) },
  })))];
}
