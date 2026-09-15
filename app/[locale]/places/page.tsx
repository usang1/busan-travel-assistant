import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlacesExplorer } from "@/components/PlacesExplorer";
import { SectionTitle } from "@/components/SectionTitle";
import { getBusanDistrictLabel, isBusanDistrictKey } from "@/lib/busan-districts";
import { getCachedPlaceRankings, getCachedPublicPlaces } from "@/lib/public-cache";
import { translatedPlaceLocales } from "@/lib/public-seo";
import { placeCategories, type PlaceCategory } from "@/types/database";
import {
  buildLocalizedMetadata,
  isLocale,
  type Locale,
  ui,
} from "@/lib/i18n";

type LocalizedPlacesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    search?: string;
    q?: string;
    category?: string;
    region?: string;
  }>;
};

export const revalidate = 300;

async function getLocale(params: LocalizedPlacesPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedPlacesPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.places.title,
    description: copy.places.description,
    path: "/places",
  });
}

export default async function LocalizedPlacesPage({ params, searchParams }: LocalizedPlacesPageProps) {
  const locale = await getLocale(params);
  const query = await searchParams;
  const copy = ui[locale];
  const rankingCategory = parseRankingCategory(query?.category);
  const rankingRegion = isBusanDistrictKey(query?.region) ? getBusanDistrictLabel(query.region, "ko") : undefined;
  const [{ places: publicPlaces, source, error }, rankings] = await Promise.all([
    getCachedPublicPlaces(locale),
    getCachedPlaceRankings({ limit: 4, category: rankingCategory, region: rankingRegion }),
  ]);
  const places = publicPlaces.filter((place) => translatedPlaceLocales(place).includes(locale));
  const localeRankings = {
    popular: rankings.popular.filter((place) => translatedPlaceLocales(place).includes(locale)),
    trending: rankings.trending.filter((place) => translatedPlaceLocales(place).includes(locale)),
    error: rankings.error,
  };

  return (
    <main className="safe-bottom mx-auto max-w-6xl px-4 pb-6 pt-5">
      <SectionTitle as="h1" title={copy.places.title} subtitle={source === "demo" ? copy.common.sampleData : copy.common.registeredPlaces} />
      <div className="mt-4">
        <PlacesExplorer places={places} initialCategory={query?.category} locale={locale} loadError={error} rankings={localeRankings} />
      </div>
    </main>
  );
}

function parseRankingCategory(value?: string): PlaceCategory | undefined {
  return placeCategories.includes(value as PlaceCategory) ? value as PlaceCategory : undefined;
}
