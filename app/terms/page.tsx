import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "使用条款",
  "韩国旅行助手 이용약관",
  "/terms",
);

export default function TermsPage() {
  return (
    <LegalPage
      titleZh="使用条款"
      titleKo="이용약관"
      description="이용자는 여행 참고 정보를 확인하고, 실제 방문 전 현장 및 공식 정보를 다시 확인해야 합니다."
      sections={[
        {
          title: "使用目的",
          body: "이 서비스는 여행 의사결정을 돕는 참고 도구입니다. 최종 방문, 주문, 결제, 이동 결정은 사용자의 확인과 판단에 따릅니다.",
        },
        {
          title: "付费功能",
          body: "유료 기능은 정식 결제 및 환불 정책이 준비된 뒤 별도 안내와 함께 제공됩니다. 현재 공개 화면에서는 결제 기능을 제공하지 않습니다.",
        },
        {
          title: "责任限制",
          body: "가격, 영업시간, 대기, 보관 가능 여부 등 변동 정보의 정확성을 보장하지 않으며, 방문 전 다시 확인해야 합니다.",
        },
      ]}
    />
  );
}
