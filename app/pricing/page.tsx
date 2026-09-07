import type { Metadata } from "next";
import { PricingClient } from "@/components/PricingClient";
import { absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "서비스 준비 중｜韩国旅行助手",
  description: "유료 기능은 정식 결제와 운영 정책이 준비된 뒤 제공됩니다.",
  alternates: { canonical: absoluteUrl("/pricing") },
  robots: { index: false, follow: false },
  openGraph: {
    title: "서비스 준비 중",
    description: "유료 기능은 정식 결제와 운영 정책이 준비된 뒤 제공됩니다.",
    url: absoluteUrl("/pricing"),
  },
};

export default function PricingPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <PricingClient />
    </main>
  );
}
