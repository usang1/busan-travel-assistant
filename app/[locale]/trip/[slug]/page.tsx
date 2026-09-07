import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedTripViewer } from "@/components/SharedTripViewer";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";
import { getPublicTripByShareSlug } from "@/lib/trip-store";

type LocalizedSharedTripPageProps = { params: Promise<{ locale: string; slug: string }> };

export const dynamic = "force-dynamic";

async function routeParams(params: LocalizedSharedTripPageProps["params"]): Promise<{ locale: Locale; slug: string }> {
  const value = await params;
  if (!isLocale(value.locale)) notFound();
  return { locale: value.locale, slug: value.slug };
}

export async function generateMetadata({ params }: LocalizedSharedTripPageProps): Promise<Metadata> {
  const { locale, slug } = await routeParams(params);
  const trip = await getPublicTripByShareSlug(slug);
  return buildLocalizedMetadata({
    locale,
    title: trip?.title ?? ui[locale].nav.itinerary,
    description: trip ? `${trip.start_date} - ${trip.end_date}` : ui[locale].home.description,
    path: `/trip/${slug}`,
    noIndex: true,
    follow: false,
  });
}

export default async function LocalizedSharedTripPage({ params }: LocalizedSharedTripPageProps) {
  const { locale, slug } = await routeParams(params);
  const trip = await getPublicTripByShareSlug(slug);
  if (!trip) notFound();
  return <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5"><SharedTripViewer trip={trip} locale={locale} /></main>;
}
