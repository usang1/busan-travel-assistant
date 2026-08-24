import type { Metadata } from "next";
import { Luggage, MessageSquareText } from "lucide-react";
import { LuggageExplorer } from "@/components/LuggageExplorer";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";
import { getPlaces } from "@/lib/place-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "广安里行李寄存｜退房后寄存大行李箱",
  description: "为中国游客整理广安里行李寄存点、价格、营业时间、车站距离和大行李箱可否寄存。",
  alternates: { canonical: absoluteUrl("/luggage") },
  openGraph: {
    title: "广安里行李寄存",
    description: "退房后先寄存行李，再轻松逛广安里。",
    url: absoluteUrl("/luggage"),
  },
};

export default async function LuggagePage() {
  const { places, error } = await getPlaces({ activeOnly: true });
  const luggagePlaces = places.filter((place) => place.category === "luggage");

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title="行李寄存" subtitle="광안리 짐 보관" />
      <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <Luggage size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">退房后先把行李放下</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">체크아웃 후 해변과 카페를 편하게 다닐 수 있도록 보관 위치와 보여줄 문장을 정리했습니다.</p>
        <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-200">
            <MessageSquareText size={16} aria-hidden="true" />
            给店员看
          </div>
          <p className="mt-3 text-lg font-bold">我想寄存一个行李箱，大概三个小时。</p>
          <p className="mt-2 text-sm text-slate-300">캐리어 하나를 세 시간 정도 맡기고 싶어요.</p>
        </div>
      </section>

      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <div className="mt-5">
        <LuggageExplorer places={luggagePlaces} />
      </div>
    </main>
  );
}
