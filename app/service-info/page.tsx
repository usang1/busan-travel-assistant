import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "服务说明",
  "韩国旅行助手 서울·부산·제주 서비스 범위, 데이터 출처와 이용 안내",
  "/service-info",
);

export default function ServiceInfoPage() {
  return (
    <LegalPage
      titleZh="服务说明"
      titleKo="서비스 안내"
      description="韩国旅行助手는 서울·부산·제주의 검수된 장소를 연결해 외국인 자유여행객의 빠른 의사결정을 돕는 모바일 웹서비스입니다."
      sections={[
        {
          title: "服务范围",
          body: "서울·부산·제주의 검수된 장소 검색, 주문 가이드, 실패 주의사항, 지도 연결, 주변 추천과 일정 생성 기능을 제공합니다.",
        },
        {
          title: "数据说明",
          body: "공개 화면에는 관리자가 검수해 등록한 장소 정보를 노출합니다. 확인되지 않은 업체나 통계는 임의로 만들어 표시하지 않습니다.",
        },
        {
          title: "变动信息",
          body: "价格、营业时间、等待时间、좌석 및 보관 가능 여부는 변경될 수 있으므로 방문 전 현장에서 다시 확인해야 합니다.",
        },
      ]}
    />
  );
}
