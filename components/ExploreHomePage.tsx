import { HomeDiscoveryPage } from "@/components/HomeDiscoveryPage";
import { StructuredData } from "@/components/StructuredData";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { isSocialDiscoveryEnabled } from "@/lib/feature-flags";
import { localeMeta, localizedCanonical, type Locale, ui } from "@/lib/i18n";
import { translatedPlaceLocales } from "@/lib/public-seo";

export async function ExploreHomePage({ locale }: { locale: Locale }) {
  const { places: publicPlaces } = await getCachedPublicPlaces(locale);
  const places = publicPlaces.filter((place) => translatedPlaceLocales(place).includes(locale));
  const copy = ui[locale];
  return (
    <>
      <StructuredData data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: copy.home.title,
        url: localizedCanonical("/explore", locale),
        inLanguage: localeMeta[locale].languageTag,
        description: copy.home.description,
      }} />
      <HomeDiscoveryPage locale={locale} places={places} socialDiscoveryEnabled={isSocialDiscoveryEnabled()} />
    </>
  );
}
