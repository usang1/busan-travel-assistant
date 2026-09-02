import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedTripViewer } from "@/components/SharedTripViewer";
import { getPublicTripByShareSlug } from "@/lib/trip-store";

type SharedTripPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SharedTripPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getPublicTripByShareSlug(slug);
  return {
    title: trip?.title ?? "Shared trip",
    description: trip ? `${trip.start_date} - ${trip.end_date}` : "Shared travel plan",
    robots: { index: false, follow: false },
  };
}

export default async function SharedTripPage({ params }: SharedTripPageProps) {
  const { slug } = await params;
  const trip = await getPublicTripByShareSlug(slug);
  if (!trip) notFound();
  return <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5"><SharedTripViewer trip={trip} locale="zh" /></main>;
}
