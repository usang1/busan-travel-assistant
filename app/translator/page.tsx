import type { Metadata } from "next";
import { SectionTitle } from "@/components/SectionTitle";
import { TranslatorTool } from "@/components/TranslatorTool";
import { absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "给韩国人看｜釜山旅行韩语句子",
  description: "餐厅、交通、购物、酒店和紧急场景可直接给韩国员工看的韩语句子。",
  alternates: { canonical: absoluteUrl("/translator") },
  openGraph: {
    title: "给韩国人看",
    description: "中国游客在釜山可直接展示的韩语沟通卡片。",
    url: absoluteUrl("/translator"),
  },
};

export default function TranslatorPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="给韩国人看" subtitle="한국인 직원에게 바로 보여주는 문장" />
      <div className="mt-5">
        <TranslatorTool />
      </div>
    </main>
  );
}
