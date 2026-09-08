import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomeDiscoveryPage } from "@/components/HomeDiscoveryPage";
import { StructuredData } from "@/components/StructuredData";
import { getPlaces } from "@/lib/place-store";
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

  return buildLocalizedMetadata({
    locale,
    title: copy.home.title,
    description: copy.home.description,
    path: "/",
  });
}

export default async function LocalizedHome({ params }: LocalePageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];
  const { places } = await getPlaces({ activeOnly: true, locale, debugLabel: "localized-home" });

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
        }}
      />
      <HomeDiscoveryPage locale={locale} places={places} />
    </>
  );
}
