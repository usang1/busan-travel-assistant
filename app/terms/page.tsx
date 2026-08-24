import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "使用条款",
  "釜山旅行助手 이용약관 임시 초안",
  "/terms",
);

export default function TermsPage() {
  return (
    <LegalPage
      titleZh="使用条款"
      titleKo="이용약관"
      description="본 약관은 MVP용 임시 문서이며 실제 유료 서비스 전 별도 검토가 필요합니다."
      sections={[
        {
          title: "使用目的",
          body: "이 서비스는 여행 의사결정을 돕는 참고 도구입니다. 최종 방문, 주문, 결제, 이동 결정은 사용자의 확인과 판단에 따릅니다.",
        },
        {
          title: "PRO 功能",
          body: "현재 PRO 및 결제는 Mock 시뮬레이션입니다. 실제 결제 기능 도입 전 환불, 취소, 이용기간, 고객지원 정책을 확정해야 합니다.",
        },
        {
          title: "责任限制",
          body: "가격, 영업시간, 대기, 보관 가능 여부 등 변동 정보의 정확성을 보장하지 않으며, 방문 전 다시 확인해야 합니다.",
        },
      ]}
    />
  );
}
