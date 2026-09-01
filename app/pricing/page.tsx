import type { Metadata } from "next";
import { PricingClient } from "@/components/PricingClient";
import { absoluteUrl } from "@/config/site";

export const metadata: Metadata = {
  title: "PRO 通行证｜韩国旅行助手",
  description: "了解韩国旅行助手 FREE/PRO 功能分离、3日和7日通行证，以及 Mock 支付结构。",
  alternates: { canonical: absoluteUrl("/pricing") },
  openGraph: {
    title: "PRO 通行证",
    description: "解锁完整照片点、2日以上行程和行程保存。",
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
