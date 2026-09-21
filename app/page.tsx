import type { Metadata } from "next";
import { HomeDiscoveryPage } from "@/components/HomeDiscoveryPage";
import { StructuredData } from "@/components/StructuredData";
import { buildLocalizedMetadata, localeMeta, localizedCanonical, ui } from "@/lib/i18n";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { translatedPlaceLocales } from "@/lib/public-seo";

export const revalidate = 300;

const locale = "zh";
const copy = ui[locale];

export const metadata: Metadata = buildLocalizedMetadata({
  locale,
  title: copy.home.title,
  description: copy.home.description,
  path: "/",
});

export default async function Home() {
  const { places: publicPlaces } = await getCachedPublicPlaces(locale, "busan");
  const places = publicPlaces.filter((place) => translatedPlaceLocales(place).includes(locale));

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
