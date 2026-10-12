import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";
import { buildLocalizedMetadata, isLocale, type Locale } from "@/lib/i18n";

type LocalizedPrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

const privacyCopy: Record<
  Locale,
  {
    title: string;
    description: string;
    sections: Array<{ title: string; body: string }>;
  }
> = {
  zh: {
    title: "隐私政策",
    description: "本服务仅处理提供旅行功能所需的最少信息，保存功能会根据登录状态和浏览器设置运行。",
    sections: [
      { title: "收集的信息", body: "当前位置功能仅在用户通过浏览器授权后运行，默认不在服务器保存实时位置。" },
      { title: "商家入驻申请", body: "为审核申请、确认本人或授权关系并通知结果，我们会收集申请人姓名、韩国手机号码、申请人身份、Naver Place 链接和会员 ID。申请处理结束后保存1年；法律另有要求时按法定期限保存。" },
      { title: "本地保存", body: "部分画面状态和最近使用记录可能保存在浏览器中，用户可以通过删除浏览器数据移除。" },
      { title: "第三方服务", body: "地图、认证、托管等运营所需服务可能适用各自的隐私政策。" },
    ],
  },
  en: {
    title: "Privacy Policy",
    description: "The service processes only the minimum information needed for travel features. Saved features depend on sign-in state and browser settings.",
    sections: [
      { title: "Information collected", body: "Location features run only after browser permission is granted. Real-time location is not stored on the server by default." },
      { title: "Business applications", body: "We collect the applicant name, Korean mobile number, applicant role, Naver Place URL, and account ID to review applications, verify identity or authorization, and provide updates. We retain this data for one year after processing ends unless the law requires longer." },
      { title: "Local storage", body: "Some screen state and recent activity may be stored in the browser. Users can remove it by clearing browser data." },
      { title: "Third-party services", body: "Maps, authentication, hosting, and other operational services may apply their own privacy terms." },
    ],
  },
  ja: {
    title: "プライバシーポリシー",
    description: "本サービスは旅行機能に必要な最小限の情報のみを処理し、保存機能はログイン状態とブラウザ設定に応じて動作します。",
    sections: [
      { title: "収集する情報", body: "現在地機能はブラウザで許可された場合のみ動作し、リアルタイム位置情報は標準ではサーバーに保存しません。" },
      { title: "店舗掲載申請", body: "申請審査、本人・委任関係の確認、結果案内のため、申請者名、韓国の携帯電話番号、申請者の立場、Naver Place URL、会員IDを収集します。処理終了後1年間保管し、法令に別途義務がある場合はその期間保管します。" },
      { title: "ローカル保存", body: "一部の画面状態や最近の利用情報はブラウザに保存される場合があり、ブラウザデータの削除で消去できます。" },
      { title: "外部サービス", body: "地図、認証、ホスティングなど運営に必要な外部サービスには各サービスのプライバシー条件が適用される場合があります。" },
    ],
  },
  ko: {
    title: "개인정보처리방침",
    description: "서비스 이용에 필요한 최소한의 정보만 처리하며, 저장 기능은 로그인 상태와 브라우저 설정에 따라 동작합니다.",
    sections: [
      { title: "수집하는 정보", body: "현재 위치 기능은 브라우저 권한을 통해 사용자가 허용한 경우에만 동작하며, 실시간 위치를 서버에 저장하지 않는 구조를 기본으로 합니다." },
      { title: "입점신청", body: "입점신청 검토, 본인·위임 관계 확인 및 처리 결과 안내를 위해 신청자 이름, 휴대전화 번호, 신청자 역할, 네이버 플레이스 URL, 회원 ID를 수집합니다. 신청 처리 종료 후 1년간 보관하며 관련 법령에 별도 의무가 있으면 해당 기간 보관합니다." },
      { title: "로컬 저장", body: "일부 화면 상태와 최근 이용 정보는 브라우저에 저장될 수 있으며, 사용자는 브라우저 데이터 삭제로 이를 제거할 수 있습니다." },
      { title: "외부 서비스", body: "지도, 인증, 호스팅 등 운영에 필요한 외부 서비스가 사용될 수 있으며 각 서비스의 개인정보 처리 조건이 적용될 수 있습니다." },
    ],
  },
};

async function getLocale(params: LocalizedPrivacyPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedPrivacyPageProps): Promise<Metadata> {
  const locale = await getLocale(params);

  return buildLocalizedMetadata({
    ...privacyCopy[locale],
    locale,
    path: "/privacy",
    type: "article",
  });
}

export default async function LocalizedPrivacyPage({ params }: LocalizedPrivacyPageProps) {
  const locale = await getLocale(params);
  const copy = privacyCopy[locale];

  return <LegalPage titleZh={copy.title} titleKo="" description={copy.description} sections={copy.sections} />;
}
