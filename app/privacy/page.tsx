import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata(
  "隐私政策",
  "韩国旅行助手 개인정보 처리 안내",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <LegalPage
      titleZh="隐私政策"
      titleKo="개인정보처리방침"
      description="서비스 이용 과정에서 필요한 최소한의 정보만 처리하며, 저장 기능은 로그인 상태와 브라우저 설정에 따라 동작합니다."
      sections={[
        {
          title: "收集的信息",
          body: "현재 위치 기능은 브라우저 권한을 통해 사용자가 허용한 경우에만 동작합니다. 서버에 위치를 저장하지 않는 구조를 기본으로 합니다.",
        },
        {
          title: "本地保存",
          body: "일부 화면 상태와 최근 이용 정보는 브라우저에 저장될 수 있습니다. 사용자는 브라우저 데이터 삭제로 이를 제거할 수 있습니다.",
        },
        {
          title: "第三方服务",
          body: "지도, 인증, 호스팅 등 운영에 필요한 외부 서비스가 사용될 수 있으며, 각 서비스의 개인정보 처리 조건을 함께 적용받을 수 있습니다.",
        },
      ]}
    />
  );
}
