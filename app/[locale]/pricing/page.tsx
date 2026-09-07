import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PricingPage from "@/app/pricing/page";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";

type LocalizedPricingPageProps = {
  params: Promise<{ locale: string }>;
};

const pricingSeo: Record<Locale, { title: string; description: string }> = {
  zh: { title: "服务准备中", description: "付费功能将在正式结算和运营政策准备完成后提供。" },
  en: { title: "Service in preparation", description: "Paid features will be available after payment and operating policies are ready." },
  ja: { title: "サービス準備中", description: "有料機能は決済と運用ポリシーの準備後に提供します。" },
  ko: { title: "서비스 준비 중", description: "유료 기능은 정식 결제와 운영 정책이 준비된 뒤 제공됩니다." },
};

async function getLocale(params: LocalizedPricingPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedPricingPageProps): Promise<Metadata> {
  const locale = await getLocale(params);

  return buildLocalizedMetadata({
    ...pricingSeo[locale],
    locale,
    path: "/pricing",
    noIndex: true,
    follow: false,
  });
}

export default PricingPage;
