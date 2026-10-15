"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, TicketPercent } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

type Coupon = { id: string; place_id: string; name: string; benefit_text: string; valid_from: string; valid_until: string; status: string; active: boolean };

export function BusinessCouponManager({ accessToken, places, locale }: { accessToken: string; places: PlaceWithRelations[]; locale: Locale }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState({ placeId: places[0]?.id || "", name: "", benefitText: "", validFrom: "", validUntil: "", issueLimit: "", perUserLimit: "1" });
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const text = copy[locale];
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
  const load = useCallback(async () => { try { const response = await fetch("/api/business/coupons", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.message || text.loadError); setCoupons(body.coupons || []); } catch (error) { setMessage(error instanceof Error ? error.message : text.loadError); } }, [accessToken, text.loadError]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!form.placeId && places[0]) setForm((current) => ({ ...current, placeId: places[0].id })); }, [form.placeId, places]);

  async function save(submit: boolean) { setMessage(""); try { const response = await fetch("/api/business/coupons", { method: "POST", headers, body: JSON.stringify({ ...form, submit }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || text.saveError); setMessage(body.message); setForm((current) => ({ ...current, name: "", benefitText: "", issueLimit: "" })); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : text.saveError); } }
  async function redeem() { setMessage(""); try { const response = await fetch("/api/business/coupons/redeem", { method: "POST", headers, body: JSON.stringify({ token: token.trim() }) }); const body = await response.json(); if (!response.ok) throw new Error(body.message || text.redeemError); setMessage(body.message); setToken(""); } catch (error) { setMessage(error instanceof Error ? error.message : text.redeemError); } }

  if (!places.length) return null;
  return <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-teal-50 text-teal-800"><TicketPercent size={21} /></span><div><h2 className="text-xl font-black">{text.title}</h2><p className="mt-1 text-sm text-slate-600">{text.description}</p></div></div>
    {message ? <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{message}</p> : null}
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="space-y-3"><select value={form.placeId} onChange={(e) => setForm({ ...form, placeId: e.target.value })} className="ui-input">{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko}</option>)}</select><input className="ui-input" placeholder={text.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><textarea className="ui-input min-h-24 py-3" placeholder={text.benefit} value={form.benefitText} onChange={(e) => setForm({ ...form, benefitText: e.target.value })} /><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">{text.from}<input type="datetime-local" className="ui-input mt-1" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></label><label className="text-xs font-bold text-slate-600">{text.until}<input type="datetime-local" className="ui-input mt-1" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></label></div><div className="grid gap-2 sm:grid-cols-2"><input className="ui-input" inputMode="numeric" placeholder={text.quantity} value={form.issueLimit} onChange={(e) => setForm({ ...form, issueLimit: e.target.value })} /><input className="ui-input" inputMode="numeric" placeholder={text.perUser} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} /></div><div className="flex gap-2"><button type="button" onClick={() => void save(false)} className="ui-button-secondary">{text.draft}</button><button type="button" onClick={() => void save(true)} className="ui-button-primary">{text.submit}</button></div></div>
      <div><h3 className="font-black">{text.staffTitle}</h3><p className="mt-1 text-sm text-slate-600">{text.staffDescription}</p><div className="mt-3 flex gap-2"><input className="ui-input min-w-0" value={token} onChange={(e) => setToken(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /><button type="button" onClick={() => void redeem()} disabled={!token.trim()} className="ui-button-primary shrink-0"><CheckCircle2 size={16} />{text.redeem}</button></div><h3 className="mt-6 font-black">{text.list}</h3><div className="mt-2 space-y-2">{coupons.map((coupon) => <article key={coupon.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-2"><span className="font-black">{coupon.name}</span><span className="rounded-full bg-white px-2 py-1 text-xs font-black">{coupon.status}</span></div><p className="mt-1 text-sm text-slate-600">{coupon.benefit_text}</p></article>)}{!coupons.length ? <p className="text-sm text-slate-500">{text.empty}</p> : null}</div></div>
    </div>
  </section>;
}

const copy = {
  ko: { title: "쿠폰 관리·사용 확인", description: "쿠폰은 관리자 승인 후 공개되며, 직원이 코드를 사용 처리해야 확인된 전환으로 집계됩니다.", loadError: "쿠폰 정보를 불러오지 못했습니다.", saveError: "쿠폰을 저장하지 못했습니다.", redeemError: "쿠폰 사용 처리에 실패했습니다.", name: "쿠폰명", benefit: "혜택 내용", from: "시작", until: "종료", quantity: "총 발급 수량(선택)", perUser: "사용자별 발급 한도", draft: "초안 저장", submit: "검수 요청", staffTitle: "직원 사용 확인", staffDescription: "관광객 화면의 전체 인증코드를 입력하세요. 중복·만료·다른 가게 쿠폰은 서버에서 차단됩니다.", redeem: "사용 처리", list: "내 쿠폰", empty: "등록한 쿠폰이 없습니다." },
  zh: { title: "优惠券管理与核销", description: "优惠券经管理员批准后公开，工作人员核销后才计为已确认转化。", loadError: "无法加载优惠券。", saveError: "无法保存优惠券。", redeemError: "核销失败。", name: "优惠券名称", benefit: "优惠内容", from: "开始", until: "结束", quantity: "发行总量（可选）", perUser: "每位用户上限", draft: "保存草稿", submit: "提交审核", staffTitle: "工作人员核销", staffDescription: "输入游客页面显示的完整验证码。重复、过期或其他店铺的优惠券会被服务器阻止。", redeem: "确认使用", list: "我的优惠券", empty: "暂无优惠券。" },
  en: { title: "Coupons and redemption", description: "Coupons appear after admin approval and count as confirmed conversions only after staff redemption.", loadError: "Could not load coupons.", saveError: "Could not save the coupon.", redeemError: "Could not redeem the coupon.", name: "Coupon name", benefit: "Benefit", from: "Starts", until: "Ends", quantity: "Total issue limit (optional)", perUser: "Limit per visitor", draft: "Save draft", submit: "Request review", staffTitle: "Staff redemption", staffDescription: "Enter the full code from the visitor's screen. The server blocks duplicates, expiry, and coupons for another store.", redeem: "Redeem", list: "My coupons", empty: "No coupons yet." },
  ja: { title: "クーポン管理・使用確認", description: "管理者承認後に公開され、スタッフの使用処理後に確認済み転換として集計されます。", loadError: "クーポンを読み込めません。", saveError: "クーポンを保存できません。", redeemError: "使用処理に失敗しました。", name: "クーポン名", benefit: "特典内容", from: "開始", until: "終了", quantity: "総発行数（任意）", perUser: "利用者ごとの上限", draft: "下書き保存", submit: "審査を依頼", staffTitle: "スタッフ使用確認", staffDescription: "旅行者画面の完全なコードを入力してください。重複・期限切れ・他店舗のクーポンはサーバーで拒否されます。", redeem: "使用処理", list: "クーポン一覧", empty: "クーポンはありません。" },
} satisfies Record<Locale, Record<string, string>>;
