import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "服务说明",
  "釜山旅行助手 MVP 服务范围、数据来源和使用限制 안내",
  "/service-info",
);

export default function ServiceInfoPage() {
  return (
    <LegalPage
      titleZh="服务说明"
      titleKo="서비스 안내"
      description="釜山旅行助手는 중국인 자유여행객이 광안리에서 빠르게 의사결정할 수 있도록 돕는 모바일 웹서비스입니다."
      sections={[
        {
          title: "服务范围",
          body: "현재 MVP는 부산 광안리 중심의 장소 검색, 주문 가이드, 사진스팟, 짐보관, 번역 문장, 위치 기반 추천, 일정 생성 기능을 제공합니다.",
        },
        {
          title: "数据说明",
          body: "실제 공개 환경에서는 관리자에 등록된 데이터만 노출합니다. Demo 표기가 있는 데이터는 개발 및 검증용이며 실제 업체 정보로 간주하지 않습니다.",
        },
        {
          title: "变动信息",
          body: "价格、营业时间、等待时间、좌석 및 보관 가능 여부는 변경될 수 있으므로 방문 전 현장에서 다시 확인해야 합니다.",
        },
      ]}
    />
  );
}
