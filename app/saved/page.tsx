import type { Metadata } from "next";
import { SavedItemsView } from "@/components/SavedItemsView";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "收藏｜保存的釜山旅行地点",
  description: "查看已保存的广安里地点。",
  alternates: { canonical: absoluteUrl("/saved") },
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="收藏" subtitle="저장한 장소와 최근 본 장소" />
      <div className="mt-5">
        <SavedItemsView />
      </div>
    </main>
  );
}
