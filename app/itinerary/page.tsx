import type { Metadata } from "next";
import { TripPlanner } from "@/components/TripPlanner";
import { absoluteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "旅行计划｜保存地点行程助手",
  description: "把保存的韩国旅行地点按日期整理，并通过链接分享旅行计划。",
  alternates: { canonical: absoluteUrl("/itinerary") },
  openGraph: {
    title: "韩国旅行计划",
    description: "将保存的地点按日期安排并分享旅行计划。",
    url: absoluteUrl("/itinerary"),
  },
};

export default async function ItineraryPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <TripPlanner locale="zh" />
    </main>
  );
}
