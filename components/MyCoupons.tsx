"use client";

import { useEffect, useState } from "react";
import { Copy, TicketPercent } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { Locale } from "@/lib/i18n";

type Issue = { id: string; public_token: string; status: string; issued_at: string; expires_at: string; redeemed_at: string | null; coupons?: { name?: string; benefit_text?: string; terms_text?: string; places?: { name_ko?: string } | null } | null };

export function MyCoupons({ locale }: { locale: Locale }) {
  const { session } = useAuth();
  const [items, setItems] = useState<Issue[]>([]);
  const [message, setMessage] = useState("");
  const text = copy[locale];
  useEffect(() => {
    if (!session?.access_token) return;
    const controller = new AbortController();
    fetch("/api/coupons/mine", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message); return body; })
      .then((body) => setItems(body.coupons || [])).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : text.error); });
    return () => controller.abort();
  }, [session?.access_token, text.error]);
  return <section><div className="flex items-center gap-2"><TicketPercent size={20} className="text-teal-700" /><h2 className="text-xl font-black text-slate-950">{text.title}</h2></div><p className="mt-1 text-sm text-slate-600">{text.description}</p>{message ? <p className="mt-3 text-sm font-bold text-rose-700">{message}</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="flex justify-between gap-2"><div><h3 className="font-black">{item.coupons?.name || text.coupon}</h3><p className="mt-1 text-sm text-slate-600">{item.coupons?.places?.name_ko}</p></div><span className="h-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-black">{status(item, locale)}</span></div><p className="mt-3 text-sm font-bold text-teal-800">{item.coupons?.benefit_text}</p><p className="mt-2 text-xs text-slate-500">{text.until} {new Date(item.expires_at).toLocaleString(locale)}</p>{item.status === "issued" && new Date(item.expires_at) > new Date() ? <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-950 p-3 text-white"><code className="min-w-0 flex-1 break-all text-xs font-bold">{item.public_token}</code><button type="button" aria-label={text.copy} onClick={() => void navigator.clipboard.writeText(item.public_token)} className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10"><Copy size={15} /></button></div> : null}</article>)}{!items.length && !message ? <p className="text-sm text-slate-500">{text.empty}</p> : null}</div></section>;
}

function status(item: Issue, locale: Locale) { const expired = item.status === "issued" && new Date(item.expires_at) <= new Date(); const key = expired ? "expired" : item.status; return ({ ko: { issued: "사용 가능", redeemed: "사용 완료", expired: "기간 만료", cancelled: "취소" }, zh: { issued: "可使用", redeemed: "已使用", expired: "已过期", cancelled: "已取消" }, en: { issued: "Available", redeemed: "Used", expired: "Expired", cancelled: "Cancelled" }, ja: { issued: "利用可能", redeemed: "使用済み", expired: "期限切れ", cancelled: "取消" } } as Record<Locale, Record<string, string>>)[locale][key] || key; }
const copy = { ko: { title: "내 쿠폰", description: "직원에게 일회용 코드를 보여 주세요.", error: "쿠폰을 불러오지 못했습니다.", coupon: "쿠폰", until: "유효기간", copy: "코드 복사", empty: "발급받은 쿠폰이 없습니다." }, zh: { title: "我的优惠券", description: "请向工作人员出示一次性代码。", error: "无法加载优惠券。", coupon: "优惠券", until: "有效期至", copy: "复制代码", empty: "暂无优惠券。" }, en: { title: "My coupons", description: "Show the one-time code to store staff.", error: "Could not load coupons.", coupon: "Coupon", until: "Valid until", copy: "Copy code", empty: "You have no coupons." }, ja: { title: "マイクーポン", description: "店舗スタッフにワンタイムコードを提示してください。", error: "クーポンを読み込めません。", coupon: "クーポン", until: "有効期限", copy: "コードをコピー", empty: "クーポンはありません。" } } satisfies Record<Locale, Record<string, string>>;
