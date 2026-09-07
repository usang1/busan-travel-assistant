import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { localeAlternates, locales, withLocale } from "@/lib/i18n";

const routes = [
  "/",
  "/places",
  "/photo-spots",
  "/nearby",
  "/itinerary",
  "/translator",
  "/luggage",
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
  return routes.flatMap((route) =>
    locales.map((locale) => ({
      url: absoluteUrl(withLocale(route, locale)),
      lastModified,
      changeFrequency: frequency(route),
      priority: priority(route),
      alternates: {
        languages: localeAlternates(route),
      },
    })),
  );
}
