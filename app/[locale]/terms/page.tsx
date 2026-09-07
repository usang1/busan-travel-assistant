import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";

type LocalizedTermsPageProps = {
  params: Promise<{ locale: string }>;
};

const termsCopy: Record<Locale, { title: string; description: string; sections: Array<{ title: string; body: string }> }> = {
  zh: {
    title: "使用条款",
    description: "本服务提供旅行参考信息，用户应在实际访问前再次确认现场和官方信息。",
    sections: [
      { title: "使用目的", body: "本服务是帮助旅行决策的参考工具。访问、点单、支付和移动等最终决定由用户自行确认。" },
      { title: "付费功能", body: "付费功能将在正式结算和退款政策准备完成后另行提供。目前公开页面不提供支付功能。" },
      { title: "责任限制", body: "价格、营业时间、等待、寄存可否等变动信息不保证实时准确，访问前需要再次确认。" },
    ],
  },
  en: {
    title: "Terms of Use",
    description: "This service provides travel reference information. Users should confirm venue and official information before visiting.",
    sections: [
      { title: "Purpose", body: "The service helps with travel decisions. Final decisions on visits, orders, payment, and routes remain with the user." },
      { title: "Paid features", body: "Paid features will be introduced separately after payment and refund policies are ready. Public pages do not currently provide payment." },
      { title: "Limitations", body: "Variable information such as prices, hours, waits, seats, and storage availability is not guaranteed to be real-time accurate." },
    ],
  },
  ja: {
    title: "利用規約",
    description: "本サービスは旅行の参考情報を提供します。実際の訪問前に現地および公式情報を再確認してください。",
    sections: [
      { title: "利用目的", body: "本サービスは旅行判断を補助する参考ツールです。訪問、注文、支払い、移動の最終判断はユーザーの確認に基づきます。" },
      { title: "有料機能", body: "有料機能は決済と返金ポリシーの準備後に別途案内します。現在の公開画面では決済機能を提供していません。" },
      { title: "免責", body: "価格、営業時間、待ち時間、席や荷物預かりの可否など変動情報のリアルタイムな正確性は保証しません。" },
    ],
  },
  ko: {
    title: "이용약관",
    description: "이 서비스는 여행 참고 정보를 제공하며, 실제 방문 전 현장 및 공식 정보를 다시 확인해야 합니다.",
    sections: [
      { title: "이용 목적", body: "이 서비스는 여행 의사결정을 돕는 참고 도구입니다. 방문, 주문, 결제, 이동 결정은 사용자의 확인과 판단에 따릅니다." },
      { title: "유료 기능", body: "유료 기능은 정식 결제 및 환불 정책이 준비된 뒤 별도 안내와 함께 제공됩니다. 현재 공개 화면에서는 결제 기능을 제공하지 않습니다." },
      { title: "책임 제한", body: "가격, 영업시간, 대기, 좌석 및 보관 가능 여부 등 변동 정보의 실시간 정확성을 보장하지 않으며 방문 전 다시 확인해야 합니다." },
    ],
  },
};

async function getLocale(params: LocalizedTermsPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedTermsPageProps): Promise<Metadata> {
  const locale = await getLocale(params);

  return buildLocalizedMetadata({
    ...termsCopy[locale],
    locale,
    path: "/terms",
    type: "article",
  });
}

export default async function LocalizedTermsPage({ params }: LocalizedTermsPageProps) {
  const locale = await getLocale(params);
  const copy = termsCopy[locale];

  return <LegalPage titleZh={copy.title} titleKo="" description={copy.description} sections={copy.sections} />;
}
