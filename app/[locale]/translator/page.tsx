import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionTitle } from "@/components/SectionTitle";
import { TranslatorTool } from "@/components/TranslatorTool";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";

type LocalizedTranslatorPageProps = {
  params: Promise<{ locale: string }>;
};

const translatorCopy: Record<Locale, { title: string; description: string; subtitle: string }> = {
  zh: {
    title: "给韩国人看",
    description: "餐厅、交通、购物、酒店和紧急场景可直接给韩国员工看的韩语句子。",
    subtitle: "可直接展示给韩国员工的句子",
  },
  en: {
    title: "Korean phrase cards",
    description: "Korean phrases you can show staff in restaurants, transport, shopping, hotels, and urgent situations.",
    subtitle: "Phrases to show Korean staff",
  },
  ja: {
    title: "韓国語フレーズカード",
    description: "飲食店、交通、買い物、ホテル、緊急時に韓国のスタッフへ見せられる韓国語フレーズです。",
    subtitle: "韓国のスタッフに見せる文",
  },
  ko: {
    title: "한국어 안내 문장",
    description: "식당, 교통, 쇼핑, 숙소, 긴급 상황에서 직원에게 바로 보여줄 수 있는 한국어 문장입니다.",
    subtitle: "직원에게 바로 보여주는 문장",
  },
};

async function getLocale(params: LocalizedTranslatorPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedTranslatorPageProps): Promise<Metadata> {
  const locale = await getLocale(params);

  return buildLocalizedMetadata({
    ...translatorCopy[locale],
    locale,
    path: "/translator",
  });
}

export default async function LocalizedTranslatorPage({ params }: LocalizedTranslatorPageProps) {
  const locale = await getLocale(params);
  const copy = translatorCopy[locale];

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={copy.title} subtitle={copy.subtitle} />
      <div className="mt-5">
        <TranslatorTool />
      </div>
    </main>
  );
}
