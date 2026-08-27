import type { Metadata } from "next";
import { MySubmissionsView } from "@/components/MySubmissionsView";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "내 제보",
  description: "제출한 장소 제보의 검수 상태를 확인합니다.",
  alternates: { canonical: absoluteUrl("/submissions") },
  robots: { index: false, follow: true },
};

export default function SubmissionsPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="내 제보" subtitle="submission status" />
      <div className="mt-5">
        <MySubmissionsView />
      </div>
    </main>
  );
}
