import { LandingExperience } from "@/components/landing/LandingExperience";
import { HomeDiscoveryPage } from "@/components/HomeDiscoveryPage";
import type { LandingPlace } from "@/components/landing/types";
import { StructuredData } from "@/components/StructuredData";
import { landingCopy } from "@/components/landing/landing-copy";
import { getCachedPublicPlaces } from "@/lib/public-cache";
import { isSocialDiscoveryEnabled } from "@/lib/feature-flags";
import { buildPlaceCardFacts, getPlaceCategoryLabel, getPlaceNameDisplay, getTrustedPlaceImageUrl, getVerificationStatus } from "@/lib/place-trust";
import { getPlaceContent, localeMeta, localizedCanonical, type Locale } from "@/lib/i18n";
import { translatedPlaceLocales } from "@/lib/public-seo";

export async function LandingPage({ locale }: { locale: Locale }) {
  const result = await getCachedPublicPlaces(locale);
  const publicPlaces = result.places.filter((place) => translatedPlaceLocales(place).includes(locale));
  const places = [...result.places]
    .sort((a, b) => Number(Boolean(getTrustedPlaceImageUrl(b))) - Number(Boolean(getTrustedPlaceImageUrl(a))) || Number(b.is_featured) - Number(a.is_featured))
    .slice(0, 3)
    .map((place): LandingPlace => {
      const name = getPlaceNameDisplay(place, locale);
      const content = getPlaceContent(place, locale);
      const facts = buildPlaceCardFacts(place, locale).facts;
      return {
        id: place.id,
        slug: place.slug,
        name: name.name,
        secondaryName: name.secondaryName,
        category: getPlaceCategoryLabel(place.category, locale),
        address: content.address || content.addressOriginalKo,
        imageUrl: getTrustedPlaceImageUrl(place),
        latitude: place.latitude,
        longitude: place.longitude,
        facts: facts.map((fact) => ({ key: fact.key, label: fact.label, value: fact.value })),
        verified: getVerificationStatus(place) === "verified",
      };
    });
  const copy = landingCopy[locale];

  return (
    <>
      <StructuredData data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Spotzari",
        url: localizedCanonical("/", locale),
        inLanguage: localeMeta[locale].languageTag,
        description: copy.metaDescription,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${localizedCanonical("/places", locale)}?search={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      }} />
      <LandingExperience locale={locale} places={places}>
        <HomeDiscoveryPage
          locale={locale}
          places={publicPlaces}
          socialDiscoveryEnabled={isSocialDiscoveryEnabled()}
          embedded
        />
      </LandingExperience>
    </>
  );
}
