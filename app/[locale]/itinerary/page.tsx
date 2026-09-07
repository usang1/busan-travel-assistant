import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TripPlanner } from "@/components/TripPlanner";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type LocalizedItineraryPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const dynamic = "force-dynamic";

async function getLocale(params: LocalizedItineraryPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedItineraryPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.nav.itinerary,
    description: copy.home.description,
    path: "/itinerary",
  });
}

export default async function LocalizedItineraryPage({ params }: LocalizedItineraryPageProps) {
  const locale = await getLocale(params);

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <TripPlanner locale={locale} />
    </main>
  );
}
