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
    description: "韩国旅行助手连接首尔、釜山、济州的已审核地点，帮助自由行游客更快做出旅行决定。",
    sections: [
      { title: "服务范围", body: "提供首尔、釜山、济州已审核地点的搜索、点单指南、避坑信息、附近推荐和行程整理功能。" },
      { title: "数据说明", body: "公开页面仅显示管理员审核后登记的地点信息，不会因为数据不足而生成虚假地点或统计。" },
      { title: "变动信息", body: "价格、营业时间、等待时间、座位和寄存可否可能变化，出发前请再次确认。" },
    ],
  },
  en: {
    title: "Service Information",
    description: "Korea Travel Assistant connects reviewed places across Seoul, Busan, and Jeju to help independent travelers make faster trip decisions.",
    sections: [
      { title: "Scope", body: "The service provides reviewed place search, ordering guidance, failure warnings, nearby recommendations, and itinerary tools for Seoul, Busan, and Jeju." },
      { title: "Data", body: "Public pages show places reviewed by administrators. The service does not create fake places or statistics when data is missing." },
      { title: "Changing information", body: "Prices, hours, waits, seats, and luggage storage availability can change. Please confirm before visiting." },
    ],
  },
  ja: {
    title: "サービス案内",
    description: "韓国旅行アシスタントはソウル・釜山・済州の確認済みスポットをつなぎ、個人旅行者の判断を支援します。",
    sections: [
      { title: "サービス範囲", body: "ソウル・釜山・済州の確認済みスポット検索、注文ガイド、失敗注意、近くのおすすめ、旅程整理機能を提供します。" },
      { title: "データ", body: "公開画面には管理者が確認したスポット情報のみを表示し、データ不足を理由に架空のスポットや統計を作成しません。" },
      { title: "変動情報", body: "価格、営業時間、待ち時間、席、荷物預かりの可否は変わる場合があります。訪問前に再確認してください。" },
    ],
  },
  ko: {
    title: "서비스 안내",
    description: "한국 여행 어시스턴트는 서울·부산·제주의 검수된 장소를 연결해 자유여행객의 빠른 의사결정을 돕습니다.",
    sections: [
      { title: "서비스 범위", body: "서울·부산·제주의 검수된 장소 검색, 주문 가이드, 실패 주의사항, 주변 추천, 일정 정리 기능을 제공합니다." },
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
