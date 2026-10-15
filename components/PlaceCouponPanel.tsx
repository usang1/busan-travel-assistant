"use client";

import { useEffect, useState } from "react";
import { Check, Copy, TicketPercent } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { captureSessionAttribution, readSessionAttribution } from "@/lib/analytics-source";
import type { Locale } from "@/lib/i18n";

type Coupon = { id: string; name: string; benefit_text: string; valid_until: string; daily_start: string | null; daily_end: string | null };
type Issue = { token: string; expiresAt: string; status: string };

export function PlaceCouponPanel({ placeId, locale }: { placeId: string; locale: Locale }) {
  const { session } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [issues, setIssues] = useState<Record<string, Issue>>({});
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const text = copy[locale];

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/coupons?placeId=${encodeURIComponent(placeId)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then((body) => setCoupons(Array.isArray(body.coupons) ? body.coupons : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [placeId]);

  async function issue(coupon: Coupon) {
    captureSessionAttribution();
    const visitId = readSessionAttribution()?.visit_id;
    if (!visitId) return setMessage(text.sessionError);
    setLoadingId(coupon.id); setMessage("");
    try {
      const response = await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ couponId: coupon.id, visitId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || text.issueError);
      setIssues((current) => ({ ...current, [coupon.id]: body.issue }));
    } catch (error) { setMessage(error instanceof Error ? error.message : text.issueError); }
    finally { setLoadingId(""); }
  }

  if (!coupons.length) return null;
  return <section className="mt-8 border border-[#d8e0d5] bg-[#edf2eb] p-5 sm:p-6">
    <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#4f6652] text-white"><TicketPercent size={21} /></span><div><h2 className="text-xl font-black text-[#252824]">{text.title}</h2><p className="mt-1 text-sm text-slate-600">{text.description}</p></div></div>
    {message ? <p role="alert" className="mt-4 rounded-xl bg-white p-3 text-sm font-bold text-rose-700">{message}</p> : null}
    <div className="mt-5 grid gap-3">{coupons.map((coupon) => { const issueValue = issues[coupon.id]; return <article key={coupon.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#d8e0d5]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{coupon.name}</h3><p className="mt-1 text-sm font-bold text-teal-800">{coupon.benefit_text}</p><p className="mt-2 text-xs text-slate-500">{text.until} {new Date(coupon.valid_until).toLocaleDateString(locale)}</p></div>{issueValue ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800"><Check size={14} />{text.issued}</span> : <button type="button" onClick={() => void issue(coupon)} disabled={loadingId === coupon.id} className="min-h-11 rounded-xl bg-[#26352c] px-4 text-sm font-black text-white disabled:opacity-60">{loadingId === coupon.id ? text.issuing : text.issue}</button>}</div>{issueValue ? <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold text-slate-300">{text.staffCode}</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-sm font-black">{issueValue.token}</code><button type="button" onClick={() => void navigator.clipboard.writeText(issueValue.token)} aria-label={text.copy} className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10"><Copy size={16} /></button></div><p className="mt-2 text-xs text-slate-400">{text.redemptionNotice}</p></div> : null}</article>; })}</div>
  </section>;
}

const copy = {
  ko: { title: "방문 쿠폰", description: "가게에서 직원 확인 후 사용 처리되는 쿠폰입니다.", until: "유효기간", issue: "쿠폰 받기", issuing: "발급 중", issued: "발급 완료", staffCode: "직원 확인용 코드", copy: "코드 복사", redemptionNotice: "가게 직원이 이 코드를 확인하고 사용 처리해야 전환으로 집계됩니다.", issueError: "쿠폰을 발급하지 못했습니다.", sessionError: "방문 세션을 만들지 못했습니다. 페이지를 새로고침해 주세요." },
  zh: { title: "到店优惠券", description: "到店后由工作人员核销。", until: "有效期至", issue: "领取优惠券", issuing: "领取中", issued: "已领取", staffCode: "工作人员核销码", copy: "复制代码", redemptionNotice: "只有工作人员确认并核销后，才会计为已验证的优惠券转化。", issueError: "无法领取优惠券。", sessionError: "无法创建访问会话，请刷新页面。" },
  en: { title: "Visit coupon", description: "A staff member validates this coupon at the store.", until: "Valid until", issue: "Get coupon", issuing: "Issuing", issued: "Issued", staffCode: "Staff validation code", copy: "Copy code", redemptionNotice: "This counts as a confirmed coupon conversion only after store staff redeem it.", issueError: "Could not issue this coupon.", sessionError: "Could not create a visit session. Reload the page." },
  ja: { title: "来店クーポン", description: "店舗スタッフの確認後に使用処理されます。", until: "有効期限", issue: "クーポンを受け取る", issuing: "発行中", issued: "発行済み", staffCode: "スタッフ確認コード", copy: "コードをコピー", redemptionNotice: "店舗スタッフが確認して使用処理した時点で、確認済みクーポン転換として集計されます。", issueError: "クーポンを発行できませんでした。", sessionError: "訪問セッションを作成できません。ページを再読み込みしてください。" },
} satisfies Record<Locale, Record<string, string>>;
