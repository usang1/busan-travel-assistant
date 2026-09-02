import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceRankingSection } from "@/components/PlaceRankingSection";
import { QuickActionCard } from "@/components/QuickActionCard";
import { SearchBar } from "@/components/SearchBar";
import { SectionTitle } from "@/components/SectionTitle";
import { StructuredData } from "@/components/StructuredData";
import { TripPlannerEntryLink } from "@/components/TripPlannerEntryLink";
import { quickActions } from "@/data/places";
import { getPlaces } from "@/lib/place-store";
import { getPlaceRankings } from "@/lib/place-recommendations";
import {
  isLocale,
  localeAlternates,
  localeMeta,
  localizedCanonical,
  type Locale,
  ui,
  withLocale,
} from "@/lib/i18n";

type LocalePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const dynamic = "force-dynamic";

async function getLocale(params: LocalePageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return {
    title: copy.home.title,
    description: copy.home.description,
    alternates: {
      canonical: localizedCanonical("/", locale),
      languages: localeAlternates("/"),
    },
    openGraph: {
      title: copy.home.title,
      description: copy.home.description,
      url: localizedCanonical("/", locale),
      siteName: copy.siteName,
      locale: localeMeta[locale].openGraphLocale,
      type: "website",
    },
  };
}

export default async function LocalizedHome({ params }: LocalePageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];
  const [{ places, source, error }, rankings] = await Promise.all([
    getPlaces({ activeOnly: true, featuredOnly: true, locale, debugLabel: "localized-home-featured" }),
    getPlaceRankings({ limit: 4 }),
  ]);
  const recommended = places.slice(0, 4);

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: copy.siteName,
          url: localizedCanonical("/", locale),
          inLanguage: localeMeta[locale].languageTag,
          description: copy.home.description,
        }}
      />
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-50 ring-1 ring-white/10">
          <MapPin size={15} aria-hidden="true" />
          {copy.home.area}
        </div>
        <h1 className="max-w-sm text-4xl font-black leading-tight tracking-normal">
          {copy.home.heading}
          <span className="mt-2 block text-2xl font-semibold text-teal-100">{copy.home.subheading}</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">{copy.home.supporting}</p>
        <div className="mt-6">
          <SearchBar placeholder={copy.home.searchPlaceholder} />
        </div>
      </section>

      <section className="mt-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title.zh} action={action} locale={locale} />
          ))}
        </div>
        <div className="mt-3">
          <TripPlannerEntryLink locale={locale} context="home" />
        </div>
      </section>

      <PlaceRankingSection rankings={rankings} locale={locale} />

      <section className="mt-8 space-y-4">
        <SectionTitle
          title={copy.home.recommended}
          subtitle={source === "demo" ? "Demo 데이터 표시 중" : "Supabase"}
          action={
            <Link href={withLocale("/places", locale)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              {copy.common.viewAll}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        {error ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {recommended.map((place, index) => (
            <PlaceCard key={place.id} place={place} priority={index === 0} locale={locale} />
          ))}
        </div>
      </section>
    </main>
  );
}
