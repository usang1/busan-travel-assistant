import type { Metadata } from "next";
import { SavedItemsView } from "@/components/SavedItemsView";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "收藏｜保存的釜山旅行地点",
  description: "查看已收藏的广安里地点和拍照机位。",
  alternates: { canonical: absoluteUrl("/saved") },
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="收藏" subtitle="저장한 장소와 사진스팟" />
      <div className="mt-5">
        <SavedItemsView />
      </div>
    </main>
  );
}
