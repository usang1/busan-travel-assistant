import { getPlaceContent, locales, localizedCanonical, type Locale } from "@/lib/i18n";
import { hasCoordinates } from "@/lib/location";
import { isPublishablePlace } from "@/lib/place-publication-quality";
import { isVerifiedPlace } from "@/lib/place-publication-quality";
import { normalizePlacePricing } from "@/lib/place-data-integrity";
import { getPublicPlaceDescription, getTrustedPlaceImageUrl } from "@/lib/place-trust";
import type { PlaceCategory, PlaceWithRelations } from "@/types/database";
import type { Guide } from "@/types/guide";

export const placeSchemaTypes: Record<PlaceCategory, string> = {
  restaurant: "Restaurant", cafe: "CafeOrCoffeeShop", bar: "BarOrPub",
  attraction: "TouristAttraction", photo_spot: "TouristAttraction",
  shopping: "Store", luggage: "SelfStorage",
};

export function translatedPlaceLocales(place: PlaceWithRelations): Locale[] {
  if (!isPublishablePlace(place)) return [];
  return locales.filter((locale) => {
    const translatedName = place.translations?.find((item) => item.locale === locale)?.name?.trim();
    const name = translatedName || (locale === "ko" ? place.name_ko : locale === "zh" ? place.name_zh : "");
    return Boolean(name?.trim());
  });
}

export function translatedGuideLocales(guide: Guide): Locale[] {
  if (guide.status !== "PUBLISHED") return [];
  return locales.filter((locale) => guide[`title_${locale}`]?.trim() && guide[`description_${locale}`]?.trim());
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name, item: item.url,
    })),
  };
}

export function placeSchema(place: PlaceWithRelations, locale: Locale) {
  const content = getPlaceContent(place, locale);
  const pricing = normalizePlacePricing(place);
  const price = [pricing.priceMin, pricing.priceMax].filter((value): value is number => value !== null);
  const streetAddress = content.address || place.address_ko.trim();
  const postalCode = streetAddress.match(/(?:^|\s)(\d{5})(?:\s|$)/)?.[1];
  const addressRegion = place.city_code === "busan" ? "Busan" : place.city_code === "seoul" ? "Seoul" : place.city_code === "jeju" ? "Jeju" : undefined;
  return {
    "@context": "https://schema.org", "@type": placeSchemaTypes[place.category],
    name: content.name, alternateName: content.secondaryName || undefined,
    description: isVerifiedPlace(place) ? getPublicPlaceDescription(place, locale) || undefined : undefined,
    image: getTrustedPlaceImageUrl(place) || undefined,
    url: localizedCanonical(`/places/${place.slug}`, locale),
    address: streetAddress ? {
      "@type": "PostalAddress",
      streetAddress,
      addressCountry: "KR",
      addressRegion,
      addressLocality: place.district_code || undefined,
      postalCode,
    } : undefined,
    telephone: place.phone?.trim() || undefined,
    ...(place.category !== "attraction" && place.category !== "photo_spot" && price.length ? { priceRange: `${price.join(" - ")} KRW` } : {}),
    geo: hasCoordinates(place) ? { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude } : undefined,
  };
}
