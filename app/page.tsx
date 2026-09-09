import type { Metadata } from "next";
import { HomeDiscoveryPage } from "@/components/HomeDiscoveryPage";
import { StructuredData } from "@/components/StructuredData";
import { getPublishedGuides } from "@/lib/guide-store";
import { getPlaces } from "@/lib/place-store";
import { buildLocalizedMetadata, localeMeta, localizedCanonical, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const locale = "zh";
const copy = ui[locale];

export const metadata: Metadata = buildLocalizedMetadata({
  locale,
  title: copy.home.title,
  description: copy.home.description,
  path: "/",
});

export default async function Home() {
  const [{ places }, { guides }] = await Promise.all([
    getPlaces({ activeOnly: true, locale, debugLabel: "home" }),
    getPublishedGuides(),
  ]);

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
      <HomeDiscoveryPage locale={locale} places={places} guides={guides} />
    </>
  );
}
