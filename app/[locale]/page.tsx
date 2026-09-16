import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeDiscoveryPage, isHomeCityKey } from "@/components/HomeDiscoveryPage";
import { StructuredData } from "@/components/StructuredData";
import {
  buildLocalizedMetadata,
  isLocale,
  localeMeta,
  localizedCanonical,
  type Locale,
  ui,
} from "@/lib/i18n";

type LocalePageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    city?: string;
  }>;
};

export const revalidate = 300;

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

  return buildLocalizedMetadata({
    locale,
    title: copy.home.title,
    description: copy.home.description,
    path: "/",
  });
}

export default async function LocalizedHome({ params, searchParams }: LocalePageProps) {
  const locale = await getLocale(params);
  const query = await searchParams;
  const selectedCity = isHomeCityKey(query?.city) ? query.city : undefined;
  const copy = ui[locale];
  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: copy.siteName,
          url: localizedCanonical("/", locale),
          inLanguage: localeMeta[locale].languageTag,
          description: copy.home.description,
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${localizedCanonical("/places", locale)}?search={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <HomeDiscoveryPage locale={locale} selectedCity={selectedCity} />
    </>
  );
}
