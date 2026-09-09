import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";
import { localeAlternates, locales, withLocale } from "@/lib/i18n";
import { getPublishedGuides } from "@/lib/guide-store";

export const dynamic = "force-dynamic";

const routes = [
  "/",
  "/places",
  "/guides",
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const frequency = (route: string): MetadataRoute.Sitemap[number]["changeFrequency"] =>
    route === "/" ? "daily" : "weekly";
  const priority = (route: string) => (route === "/" ? 1 : 0.7);
  const staticEntries = routes.flatMap((route) =>
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
  const { guides, unavailable } = await getPublishedGuides();
  if (unavailable) return staticEntries;
  return [...staticEntries, ...guides.flatMap((guide) => locales.map((locale) => ({
    url: absoluteUrl(withLocale(`/guides/${guide.slug}`, locale)),
    lastModified: new Date(guide.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
    alternates: { languages: localeAlternates(`/guides/${guide.slug}`) },
  })))];
}
