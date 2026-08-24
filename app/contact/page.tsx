import { LegalPage, legalMetadata } from "@/components/LegalPage";
import { siteConfig } from "@/config/site";

export const metadata = legalMetadata(
  "联系方式",
  "釜山旅行助手 문의 및 운영자 연락처",
  "/contact",
);

export default function ContactPage() {
  return (
    <LegalPage
      titleZh="联系方式"
      titleKo="문의"
      description="서비스 문의, 장소 정보 수정 요청, 제휴 문의를 받을 수 있는 기본 연락처입니다."
      sections={[
        {
          title: "Email",
          body: `${siteConfig.contactEmail} - 실제 출시 전 운영 이메일로 변경하세요.`,
        },
        {
          title: "商家信息 수정",
          body: "장소명, 가격, 운영시간, 메뉴, 사진 정보 수정 요청은 관리자 검수 후 반영하는 구조를 권장합니다.",
        },
      ]}
    />
  );
}
