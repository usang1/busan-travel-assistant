import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "隐私政策",
  "釜山旅行助手 개인정보 처리 임시 안내",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <LegalPage
      titleZh="隐私政策"
      titleKo="개인정보처리방침"
      description="현재 MVP는 회원가입 없이 localStorage 기반 저장 및 PRO 권한 시뮬레이션을 사용합니다."
      sections={[
        {
          title: "收集的信息",
          body: "현재 위치 기능은 브라우저 권한을 통해 사용자가 허용한 경우에만 동작합니다. 서버에 위치를 저장하지 않는 구조를 기본으로 합니다.",
        },
        {
          title: "本地保存",
          body: "收藏、Mock PRO 권한, 익명 세션 ID, 저장된 일정은 브라우저 localStorage에 저장될 수 있습니다. 사용자는 브라우저 데이터 삭제로 제거할 수 있습니다.",
        },
        {
          title: "第三方服务",
          body: "Supabase, Vercel, 지도/결제 Provider를 연결할 경우 각 서비스의 개인정보 처리 조건을 별도로 검토해야 합니다.",
        },
      ]}
    />
  );
}
