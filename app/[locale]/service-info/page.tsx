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
    description: "韩国旅行助手整理首尔、釜山、济州的公开地点，并分别标注审核状态，帮助自由行游客更快做出旅行决定。",
    sections: [
      { title: "服务范围", body: "提供首尔、釜山、济州公开地点搜索、点单指南、避坑信息、已审核地点推荐和行程整理功能。" },
      { title: "数据说明", body: "公开状态与审核完成状态分别显示；未确认字段会明确标注，不会因为数据不足而生成虚假地点或统计。" },
      { title: "变动信息", body: "价格、营业时间、等待时间、座位和寄存可否可能变化，出发前请再次确认。" },
    ],
  },
  en: {
    title: "Service Information",
    description: "Korea Travel Assistant lists public places across Seoul, Busan, and Jeju with review status shown separately.",
    sections: [
      { title: "Scope", body: "The service provides public place search, ordering guidance, reviewed-place recommendations, nearby discovery, and itinerary tools." },
      { title: "Data", body: "Published and fully reviewed are separate states. Unconfirmed fields are labeled and are not filled with invented places or statistics." },
      { title: "Changing information", body: "Prices, hours, waits, seats, and luggage storage availability can change. Please confirm before visiting." },
    ],
  },
  ja: {
    title: "サービス案内",
    description: "韓国旅行アシスタントはソウル・釜山・済州の公開スポットと確認状態を分けて表示します。",
    sections: [
      { title: "サービス範囲", body: "ソウル・釜山・済州の公開スポット検索、注文ガイド、確認済みスポットのおすすめ、周辺検索、旅程整理機能を提供します。" },
      { title: "データ", body: "公開状態と確認完了状態を分け、未確認項目を明示します。データ不足を理由に架空のスポットや統計を作成しません。" },
      { title: "変動情報", body: "価格、営業時間、待ち時間、席、荷物預かりの可否は変わる場合があります。訪問前に再確認してください。" },
    ],
  },
  ko: {
    title: "서비스 안내",
    description: "한국 여행 어시스턴트는 서울·부산·제주의 공개 장소와 검수 상태를 구분해 빠른 여행 의사결정을 돕습니다.",
    sections: [
      { title: "서비스 범위", body: "서울·부산·제주의 공개 장소 검색, 주문 가이드, 검수 완료 장소 추천, 주변 탐색, 일정 정리 기능을 제공합니다." },
      { title: "데이터 안내", body: "공개 상태와 검수 완료 상태를 구분하고 미확인 필드를 표시합니다. 데이터가 없다는 이유로 가짜 장소나 통계를 만들지 않습니다." },
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
