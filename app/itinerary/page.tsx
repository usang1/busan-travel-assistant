import type { Metadata } from "next";
import { ItineraryPlanner } from "@/components/ItineraryPlanner";
import { absoluteUrl } from "@/config/site";
import { getPlaces } from "@/lib/place-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "釜山广安里旅行路线生成｜AI-ready 行程助手",
  description: "根据旅行天数、人数、预算和喜好，用已登记地点生成广安里旅行路线。",
  alternates: { canonical: absoluteUrl("/itinerary") },
  openGraph: {
    title: "釜山广安里旅行路线生成",
    description: "基于已登记地点的旅行路线生成工具。",
    url: absoluteUrl("/itinerary"),
  },
};

export default async function ItineraryPage() {
  const { places, error } = await getPlaces({ activeOnly: true, locale: "zh", debugLabel: "itinerary" });

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      {error ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
      <ItineraryPlanner places={places} />
    </main>
  );
}
