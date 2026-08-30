import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NearbyExplorer } from "@/components/NearbyExplorer";
import { getPlaces } from "@/lib/place-store";
import {
  isLocale,
  localeAlternates,
  localizedCanonical,
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

  return {
    title: `${copy.nav.nearby} | ${copy.siteName}`,
    description: copy.places.description,
    alternates: {
      canonical: localizedCanonical("/nearby", locale),
      languages: localeAlternates("/nearby"),
    },
  };
}

export default async function LocalizedNearbyPage({ params }: LocalizedNearbyPageProps) {
  const locale = await getLocale(params);
  const { places, error } = await getPlaces({ activeOnly: true, locale, debugLabel: "localized-nearby" });

  return (
    <main className="safe-bottom mx-auto max-w-7xl px-4 pb-6 pt-5 lg:px-6">
      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <NearbyExplorer places={places} locale={locale} loadError={error} />
    </main>
  );
}
