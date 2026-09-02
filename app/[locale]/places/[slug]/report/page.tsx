import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceCorrectionPageView } from "@/components/PlaceCorrectionPageView";
import { isLocale, type Locale } from "@/lib/i18n";
import { getPlaceBySlug } from "@/lib/place-store";

type LocalizedPlaceReportPageProps = { params: Promise<{ locale: string; slug: string }> };

export const dynamic = "force-dynamic";

async function getRouteParams(params: LocalizedPlaceReportPageProps["params"]): Promise<{ locale: Locale; slug: string }> {
  const value = await params;
  if (!isLocale(value.locale)) notFound();
  return { locale: value.locale, slug: value.slug };
}

export async function generateMetadata({ params }: LocalizedPlaceReportPageProps): Promise<Metadata> {
  const { locale } = await getRouteParams(params);
  const metadata = {
    ko: { title: "영업정보 제보", description: "장소의 영업시간, 메뉴, 가격 등의 정보를 관리자에게 제보합니다." },
    zh: { title: "补充商家信息", description: "提交地点营业时间、菜单、价格等信息供管理员审核。" },
    en: { title: "Update business information", description: "Submit verified hours, menu, prices, and other place information for review." },
    ja: { title: "店舗情報を報告", description: "営業時間、メニュー、価格などの店舗情報を管理者に報告します。" },
  }[locale];
  return { ...metadata, robots: { index: false, follow: false } };
}

export default async function LocalizedPlaceReportPage({ params }: LocalizedPlaceReportPageProps) {
  const { locale, slug } = await getRouteParams(params);
  const { place } = await getPlaceBySlug(slug);
  if (!place) notFound();
  return <PlaceCorrectionPageView place={place} locale={locale} />;
}
