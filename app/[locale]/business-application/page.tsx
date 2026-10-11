import { notFound } from "next/navigation";
import { BusinessApplicationForm } from "@/components/BusinessApplicationForm";
import { SectionTitle } from "@/components/SectionTitle";
import { SubmissionTypeNavigation } from "@/components/SubmissionTypeNavigation";
import { isLocale, type Locale } from "@/lib/i18n";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const titles: Record<Locale, string> = { ko: "가게 입점 신청", zh: "商家入驻申请", en: "Business listing application", ja: "店舗掲載申請" }; return <main className="safe-bottom mx-auto max-w-3xl px-4 pb-8 pt-5"><SectionTitle as="h1" title={titles[locale]} subtitle="business owner application" /><div className="mt-5"><SubmissionTypeNavigation active="business" locale={locale} /></div><div className="mt-4"><BusinessApplicationForm locale={locale} /></div></main>; }
