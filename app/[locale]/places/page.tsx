import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlacesExplorer } from "@/components/PlacesExplorer";
import { SectionTitle } from "@/components/SectionTitle";
import { getPlaces } from "@/lib/place-store";
import {
  isLocale,
  localeAlternates,
  localeMeta,
  localizedCanonical,
  type Locale,
  ui,
} from "@/lib/i18n";

type LocalizedPlacesPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    category?: string;
  }>;
};

export const dynamic = "force-dynamic";

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

  return {
    title: copy.places.title,
    description: copy.places.description,
    alternates: {
      canonical: localizedCanonical("/places", locale),
      languages: localeAlternates("/places"),
    },
    openGraph: {
      title: copy.places.title,
      description: copy.places.description,
      url: localizedCanonical("/places", locale),
      siteName: copy.siteName,
      locale: localeMeta[locale].openGraphLocale,
    },
  };
}

export default async function LocalizedPlacesPage({ params, searchParams }: LocalizedPlacesPageProps) {
  const locale = await getLocale(params);
  const query = await searchParams;
  const copy = ui[locale];
  const { places, source, error } = await getPlaces({ activeOnly: true, locale, debugLabel: "localized-places" });

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={copy.places.heading} subtitle={source === "demo" ? "Demo 데이터 표시 중" : "Supabase"} />
      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <div className="mt-4">
        <PlacesExplorer places={places} initialCategory={query?.category} locale={locale} loadError={error} />
      </div>
    </main>
  );
}
