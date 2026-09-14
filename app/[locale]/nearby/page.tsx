import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { getPlaces } from "@/lib/place-store";
import { translatedPlaceLocales } from "@/lib/public-seo";
import {
  buildLocalizedMetadata,
  isLocale,
  type Locale,
  ui,
} from "@/lib/i18n";

type LocalizedNearbyPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const dynamic = "force-dynamic";

async function getLocale(params: LocalizedNearbyPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedNearbyPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.nav.nearby,
    description: copy.places.description,
    path: "/nearby",
  });
}

export default async function LocalizedNearbyPage({ params }: LocalizedNearbyPageProps) {
  const locale = await getLocale(params);
  const { places: publicPlaces, error } = await getPlaces({ activeOnly: true, locale, debugLabel: "localized-nearby" });
  const places = publicPlaces.filter((place) => translatedPlaceLocales(place).includes(locale));

  return (
    <main className="safe-bottom mx-auto max-w-7xl px-4 pb-6 pt-5 lg:px-6">
      <NearbyExplorer places={places} locale={locale} loadError={error} />
    </main>
  );
}
