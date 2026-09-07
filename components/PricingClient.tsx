"use client";

import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { usePathname } from "next/navigation";
import { freeFeatures, proFeatures } from "@/config/monetization";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { defaultLocale, getLocaleFromPath, withLocale } from "@/lib/i18n";

export function PricingClient() {
  const { isPro, entitlement, remainingDays } = useProEntitlement();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-teal-100 ring-1 ring-white/10">
          <Crown size={16} aria-hidden="true" />
          FREE / PRO
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">升级旅行助手</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          유료 기능은 정식 결제와 운영 정책이 준비된 뒤 제공됩니다.
        </p>
        <div className="mt-5 rounded-[22px] bg-white/10 p-4">
          <p className="text-sm text-slate-300">当前状态</p>
          <p className="mt-1 text-2xl font-black">{isPro ? `PRO · 剩余 ${remainingDays} 天` : "FREE"}</p>
          {entitlement ? <p className="mt-2 text-xs text-slate-300">만료: {new Date(entitlement.expirationAt).toLocaleString("ko-KR")}</p> : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FeatureBox title="FREE" items={freeFeatures} />
        <FeatureBox title="PRO" items={proFeatures} pro />
      </section>

      <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-black text-slate-950">결제 준비 중</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          현재 공개 사이트에서는 결제 버튼을 제공하지 않습니다. 제휴 또는 서비스 문의는 문의 화면을 이용해 주세요.
        </p>
        <Link href={withLocale("/contact", locale)} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-teal-700 px-4 text-sm font-black text-white">
          문의하기
        </Link>
      </section>
    </div>
  );
}

function FeatureBox({ title, items, pro = false }: { title: string; items: string[]; pro?: boolean }) {
  return (
    <div className={["rounded-[26px] p-5 shadow-sm ring-1", pro ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-950 ring-slate-200"].join(" ")}>
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm font-semibold">
            <Check size={16} aria-hidden="true" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
