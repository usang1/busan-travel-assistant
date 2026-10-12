import { notFound } from "next/navigation";
import { BusinessApplicationForm } from "@/components/BusinessApplicationForm";
import { SectionTitle } from "@/components/SectionTitle";
import { SubmissionTypeNavigation } from "@/components/SubmissionTypeNavigation";
import { isLocale, type Locale } from "@/lib/i18n";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const titles: Record<Locale, { title: string; subtitle: string }> = {
    ko: { title: "Spotzari 입점신청", subtitle: "가게 정보를 등록하고 해외 여행자에게 소개해 보세요." },
    zh: { title: "Spotzari 商家入驻", subtitle: "登记您的店铺，向海外旅行者介绍您的业务。" },
    en: { title: "List your business on Spotzari", subtitle: "Register your business and introduce it to international travelers." },
    ja: { title: "Spotzari 店舗掲載申請", subtitle: "店舗を登録して、海外からの旅行者に紹介しましょう。" },
  };
  return <main className="safe-bottom mx-auto max-w-3xl px-4 pb-8 pt-5"><SectionTitle as="h1" title={titles[locale].title} subtitle={titles[locale].subtitle} /><div className="mt-5"><SubmissionTypeNavigation active="business" locale={locale} /></div><div className="mt-4"><BusinessApplicationForm locale={locale} /></div></main>;
}
