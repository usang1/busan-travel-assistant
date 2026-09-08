import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";

type LocalizedServiceInfoPageProps = {
  params: Promise<{ locale: string }>;
};

const serviceInfoCopy: Record<Locale, { title: string; description: string; sections: Array<{ title: string; body: string }> }> = {
  zh: {
    title: "服务说明",
    description: "韩国旅行助手目前以釜山广安里 Beta 为中心，帮助自由行游客更快做出旅行决定。",
    sections: [
      { title: "服务范围", body: "目前提供广安里周边的地点搜索、点单指南、拍照地点、行李寄存、翻译句子、附近推荐和行程整理功能。" },
      { title: "数据说明", body: "公开页面仅显示管理员审核后登记的地点信息，不会因为数据不足而生成虚假地点或统计。" },
      { title: "变动信息", body: "价格、营业时间、等待时间、座位和寄存可否可能变化，出发前请再次确认。" },
    ],
  },
  en: {
    title: "Service Information",
    description: "Korea Travel Assistant currently focuses on the Busan Gwangalli beta and helps independent travelers make faster trip decisions.",
    sections: [
      { title: "Scope", body: "The service currently provides Gwangalli-area place search, ordering guidance, photo spots, luggage storage, Korean phrases, nearby recommendations, and itinerary tools." },
      { title: "Data", body: "Public pages show places reviewed by administrators. The service does not create fake places or statistics when data is missing." },
      { title: "Changing information", body: "Prices, hours, waits, seats, and luggage storage availability can change. Please confirm before visiting." },
    ],
  },
  ja: {
    title: "サービス案内",
    description: "韓国旅行アシスタントは現在、釜山・広安里 Beta を中心に個人旅行者の判断を支援します。",
    sections: [
      { title: "サービス範囲", body: "現在は広安里周辺のスポット検索、注文ガイド、写真スポット、荷物預かり、韓国語フレーズ、近くのおすすめ、旅程整理機能を提供します。" },
      { title: "データ", body: "公開画面には管理者が確認したスポット情報のみを表示し、データ不足を理由に架空のスポットや統計を作成しません。" },
      { title: "変動情報", body: "価格、営業時間、待ち時間、席、荷物預かりの可否は変わる場合があります。訪問前に再確認してください。" },
    ],
  },
  ko: {
    title: "서비스 안내",
    description: "한국 여행 어시스턴트는 현재 부산 광안리 Beta를 중심으로 자유여행객의 빠른 의사결정을 돕습니다.",
    sections: [
      { title: "서비스 범위", body: "현재는 광안리 주변 장소 검색, 주문 가이드, 사진스팟, 짐보관, 한국어 안내 문장, 주변 추천, 일정 정리 기능을 제공합니다." },
      { title: "데이터 안내", body: "공개 화면에는 관리자가 검수해 등록한 장소 정보를 노출하며, 데이터가 없다는 이유로 가짜 장소나 통계를 만들지 않습니다." },
      { title: "변동 정보", body: "가격, 영업시간, 대기 시간, 좌석 및 보관 가능 여부는 변경될 수 있으므로 방문 전 다시 확인해야 합니다." },
    ],
  },
};

async function getLocale(params: LocalizedServiceInfoPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedServiceInfoPageProps): Promise<Metadata> {
  const locale = await getLocale(params);

  return buildLocalizedMetadata({
    ...serviceInfoCopy[locale],
    locale,
    path: "/service-info",
    type: "article",
  });
}

export default async function LocalizedServiceInfoPage({ params }: LocalizedServiceInfoPageProps) {
  const locale = await getLocale(params);
  const copy = serviceInfoCopy[locale];

  return <LegalPage titleZh={copy.title} titleKo="" description={copy.description} sections={copy.sections} />;
}
