import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Luggage, MessageSquareText } from "lucide-react";
import { LuggageExplorer } from "@/components/LuggageExplorer";
import { SectionTitle } from "@/components/SectionTitle";
import { getPlaces } from "@/lib/place-store";
import {
  isLocale,
  localeAlternates,
  localizedCanonical,
  localeMeta,
  type Locale,
  ui,
} from "@/lib/i18n";

type LocalizedLuggagePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const dynamic = "force-dynamic";

const luggageLabels: Record<Locale, { title: string; hero: string; description: string }> = {
  zh: {
    title: "行李寄存",
    hero: "退房后先把行李放下",
    description: "为中国游客整理广安里行李寄存点、价格、营业时间、车站距离和大行李箱可否寄存。",
  },
  en: {
    title: "Luggage storage",
    hero: "Drop your bags after checkout",
    description: "Find Gwangalli luggage storage with prices, hours, station distance, and suitcase notes.",
  },
  ja: {
    title: "荷物預かり",
    hero: "チェックアウト後に荷物を預ける",
    description: "広安里の荷物預かり、料金、営業時間、駅からの距離、大型スーツケース対応を確認できます。",
  },
  ko: {
    title: "짐 보관",
    hero: "체크아웃 후 짐부터 맡기기",
    description: "광안리 짐 보관 장소, 가격, 영업시간, 역 거리, 큰 캐리어 가능 여부를 정리했습니다.",
  },
};

const luggagePhrase: Record<Locale, { title: string; phrase: string; korean: string }> = {
  zh: {
    title: "给店员看",
    phrase: "我想寄存一个行李箱，大概三个小时。",
    korean: "캐리어 하나를 세 시간 정도 맡기고 싶어요.",
  },
  en: {
    title: "Show staff",
    phrase: "I would like to store one suitcase for about three hours.",
    korean: "캐리어 하나를 세 시간 정도 맡기고 싶어요.",
  },
  ja: {
    title: "スタッフに見せる",
    phrase: "スーツケースを1つ、3時間ほど預けたいです。",
    korean: "캐리어 하나를 세 시간 정도 맡기고 싶어요.",
  },
  ko: {
    title: "직원에게 보여주기",
    phrase: "캐리어 하나를 세 시간 정도 맡기고 싶어요.",
    korean: "",
  },
};

async function getLocale(params: LocalizedLuggagePageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedLuggagePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];
  const luggageCopy = luggageLabels[locale];

  return {
    title: `${luggageCopy.title} | ${copy.siteName}`,
    description: luggageCopy.description,
    alternates: {
      canonical: localizedCanonical("/luggage", locale),
      languages: localeAlternates("/luggage"),
    },
    openGraph: {
      title: luggageCopy.title,
      description: luggageCopy.description,
      url: localizedCanonical("/luggage", locale),
      siteName: copy.siteName,
      locale: localeMeta[locale].openGraphLocale,
    },
  };
}

export default async function LocalizedLuggagePage({ params }: LocalizedLuggagePageProps) {
  const locale = await getLocale(params);
  const luggageCopy = luggageLabels[locale];
  const phraseCopy = luggagePhrase[locale];
  const { places, error } = await getPlaces({ activeOnly: true });
  const luggagePlaces = places.filter((place) => place.category === "luggage");

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={luggageCopy.title} subtitle="광안리 짐 보관" />
      <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <Luggage size={24} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-950">{luggageCopy.hero}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{luggageCopy.description}</p>
        <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-white">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-200">
            <MessageSquareText size={16} aria-hidden="true" />
            {phraseCopy.title}
          </div>
          <p className="mt-3 text-lg font-bold">{phraseCopy.phrase}</p>
          {phraseCopy.korean ? <p className="mt-2 text-sm text-slate-300">{phraseCopy.korean}</p> : null}
        </div>
      </section>

      {error ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      <div className="mt-5">
        <LuggageExplorer places={luggagePlaces} locale={locale} />
      </div>
    </main>
  );
}
