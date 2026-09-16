import type { Metadata } from "next";
import { HomeDiscoveryPage, isHomeCityKey } from "@/components/HomeDiscoveryPage";
import { StructuredData } from "@/components/StructuredData";
import { buildLocalizedMetadata, localeMeta, localizedCanonical, ui } from "@/lib/i18n";

export const revalidate = 300;

const locale = "zh";
const copy = ui[locale];

export const metadata: Metadata = buildLocalizedMetadata({
  locale,
  title: copy.home.title,
  description: copy.home.description,
  path: "/",
});

type HomePageProps = {
  searchParams?: Promise<{ city?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const query = await searchParams;
  const selectedCity = isHomeCityKey(query?.city) ? query.city : undefined;

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
      <HomeDiscoveryPage locale={locale} selectedCity={selectedCity} />
    </>
  );
}
