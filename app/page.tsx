import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import { PlaceCard } from "@/components/PlaceCard";
import { QuickActionCard } from "@/components/QuickActionCard";
import { SearchBar } from "@/components/SearchBar";
import { SectionTitle } from "@/components/SectionTitle";
import { quickActions } from "@/data/places";
import { getPlaces } from "@/lib/place-store";
import { absoluteUrl, siteConfig } from "@/config/site";
import { StructuredData } from "@/components/StructuredData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "釜山广安里旅行助手｜美食、拍照、行李寄存",
  description: "为中国自由行游客整理釜山广安里美食地图、拍照机位、韩语沟通、行李寄存和旅行路线。",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    title: "釜山广安里旅行助手",
    description: "韩国本地人帮你整理广安里怎么玩。",
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
  },
};

export default async function Home() {
  const { places, source, error } = await getPlaces({ activeOnly: true, featuredOnly: true });
  const recommended = places.slice(0, 4);

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteConfig.name,
          url: absoluteUrl("/"),
          inLanguage: "zh-CN",
          description: siteConfig.description,
        }}
      />
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-50 ring-1 ring-white/10">
          <MapPin size={15} aria-hidden="true" />
          当前区域 · 广安里
        </div>
        <h1 className="max-w-sm text-4xl font-black leading-tight tracking-normal">
          釜山怎么玩？
          <span className="mt-2 block text-2xl font-semibold text-teal-100">韩国本地人帮你整理好了。</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">부산에서 어떻게 놀지? 한국 현지인이 정리해뒀어요.</p>
        <div className="mt-6">
          <SearchBar />
        </div>
      </section>

      <section className="mt-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <QuickActionCard key={action.title.zh} action={action} />
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <SectionTitle
          title="韩国本地人推荐"
          subtitle={source === "demo" ? "Demo 데이터 표시 중" : "Supabase 추천 장소"}
          action={
            <Link href="/places" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              查看全部
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        />
        {error ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {recommended.map((place, index) => (
            <PlaceCard key={place.id} place={place} priority={index === 0} />
          ))}
        </div>
      </section>
    </main>
  );
}
