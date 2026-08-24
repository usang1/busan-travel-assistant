"use client";

import { Check, Crown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { freeFeatures, passProducts, proFeatures, type PassProduct } from "@/config/monetization";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { MockPaymentProvider } from "@/lib/payment/mock-provider";

const mockPaymentProvider = new MockPaymentProvider();

export function PricingClient() {
  const { isPro, entitlement, remainingDays, anonymousSessionId, activatePro, clearPro } = useProEntitlement();
  const [payingProductId, setPayingProductId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function pay(product: PassProduct) {
    setPayingProductId(product.id);
    setMessage("");

    try {
      const result = await mockPaymentProvider.createPayment({
        product,
        anonymousSessionId,
      });

      if (!result.ok) {
        setMessage("결제 시뮬레이션에 실패했습니다.");
        return;
      }

      activatePro({
        planId: product.id,
        provider: result.provider,
        transactionId: result.transactionId,
        activatedAt: result.paidAt,
        expirationAt: result.expirationAt,
      });
      setMessage(`${product.titleZh} 已启用。`);
    } finally {
      setPayingProductId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-teal-100 ring-1 ring-white/10">
          <Crown size={16} aria-hidden="true" />
          FREE / PRO
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">升级旅行助手</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          지금은 Mock 결제입니다. 실제 PG는 PaymentProvider 인터페이스로 교체할 수 있습니다.
        </p>
        <div className="mt-5 rounded-[22px] bg-white/10 p-4">
          <p className="text-sm text-slate-300">当前状态</p>
          <p className="mt-1 text-2xl font-black">{isPro ? `PRO · 剩余 ${remainingDays} 天` : "FREE"}</p>
          {entitlement ? <p className="mt-2 text-xs text-slate-300">만료: {new Date(entitlement.expirationAt).toLocaleString("ko-KR")}</p> : null}
        </div>
        {isPro ? (
          <button
            type="button"
            onClick={() => {
              clearPro();
              setMessage("PRO 권한을 해제했습니다.");
            }}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-bold text-white"
          >
            <RotateCcw size={16} aria-hidden="true" />
            PRO 해제
          </button>
        ) : null}
      </section>

      {message ? <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <FeatureBox title="FREE" items={freeFeatures} />
        <FeatureBox title="PRO" items={proFeatures} pro />
      </section>

      <section className="space-y-3">
        {passProducts.map((product) => (
          <article key={product.id} className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">{product.badge}</span>
                <h2 className="mt-3 text-2xl font-black text-slate-950">{product.titleZh}</h2>
                <p className="mt-1 text-sm text-slate-500">{product.titleKo}</p>
              </div>
              <p className="text-2xl font-black text-slate-950">¥{product.priceCny}</p>
            </div>
            <button
              type="button"
              onClick={() => void pay(product)}
              disabled={payingProductId === product.id}
              className="mt-5 h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {payingProductId === product.id ? "결제 시뮬레이션 중" : "Mock 결제로 PRO 활성화"}
            </button>
          </article>
        ))}
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
