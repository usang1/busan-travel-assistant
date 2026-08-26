import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { localeMeta, locales, withLocale } from "@/lib/i18n";

const routes = [
  "/",
  "/places",
  "/photo-spots",
  "/nearby",
  "/itinerary",
  "/translator",
  "/luggage",
  "/pricing",
  "/saved",
  "/service-info",
  "/privacy",
  "/terms",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const frequency = (route: string): MetadataRoute.Sitemap[number]["changeFrequency"] =>
    route === "/" ? "daily" : "weekly";
  const priority = (route: string) => (route === "/" ? 1 : 0.7);
  const localizedRoutes = routes.flatMap((route) =>
    locales.map((locale) => ({
      url: absoluteUrl(withLocale(route, locale)),
      lastModified,
      changeFrequency: frequency(route),
      priority: priority(route),
      alternates: {
        languages: locales.reduce<Record<string, string>>((acc, alternateLocale) => {
          acc[localeMeta[alternateLocale].languageTag] = absoluteUrl(withLocale(route, alternateLocale));
          return acc;
        }, {}),
      },
    })),
  );

  return [
    ...routes.map((route) => ({
      url: absoluteUrl(route),
      lastModified,
      changeFrequency: frequency(route),
      priority: priority(route),
    })),
    ...localizedRoutes,
  ];
}
