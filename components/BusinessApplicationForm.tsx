"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { hasBusinessOwnerAccess } from "@/lib/account-role";
import { parseMapUrl } from "@/lib/map-url";
import type { Locale } from "@/lib/i18n";

export function BusinessApplicationForm({ locale }: { locale: Locale }) {
  const { session, profile, loading } = useAuth();
  const [form, setForm] = useState({ storeName: "", address: "", mapUrl: "", category: "", contactName: "", contactEmail: "", contactPhone: "", relationship: "", notes: "", privacyConsent: false });
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const text = copy[locale];
  useEffect(() => { if (profile) setForm((current) => ({ ...current, contactName: current.contactName || profile.display_name || "", contactEmail: current.contactEmail || profile.email || "" })); }, [profile]);
  if (loading) return <p>{text.loading}</p>;
  if (!session) return <AuthRequiredPanel title={text.title} description={text.login} locale={locale} />;
  if (!hasBusinessOwnerAccess(profile?.role)) return <p className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-900">{text.ownerOnly}</p>;
  const field = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/business-applications", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` }, body: JSON.stringify({ ...form, locale }) });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message === "duplicate_application" ? text.duplicate : body.message ?? text.failed);
      setMessage(text.success); setForm((current) => ({ ...current, storeName: "", address: "", mapUrl: "", category: "", relationship: "", notes: "", privacyConsent: false }));
    } catch (error) { setMessage(error instanceof Error ? error.message : text.failed); } finally { setSaving(false); }
  }
  const parsed = parseMapUrl(form.mapUrl);
  return <form onSubmit={submit} className="space-y-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <p className="text-sm leading-6 text-slate-600">{text.description}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={text.store}><input required value={form.storeName} onChange={(e) => field("storeName", e.target.value)} className={inputClass} /></Field>
      <Field label={text.category}><input required value={form.category} onChange={(e) => field("category", e.target.value)} className={inputClass} /></Field>
      <div className="sm:col-span-2"><Field label={text.address}><input required value={form.address} onChange={(e) => field("address", e.target.value)} className={inputClass} /></Field></div>
      <div className="sm:col-span-2"><Field label={text.map}><textarea rows={3} value={form.mapUrl} onChange={(e) => field("mapUrl", e.target.value)} className={inputClass} placeholder={text.mapPlaceholder} />{form.mapUrl && parsed.provider === "unknown" ? <span className="text-xs font-bold text-rose-700">{text.invalidMap}</span> : null}</Field></div>
      <Field label={text.contact}><input required value={form.contactName} onChange={(e) => field("contactName", e.target.value)} className={inputClass} /></Field>
      <Field label={text.relationship}><input required value={form.relationship} onChange={(e) => field("relationship", e.target.value)} className={inputClass} /></Field>
      <Field label={text.email}><input type="email" value={form.contactEmail} onChange={(e) => field("contactEmail", e.target.value)} className={inputClass} /></Field>
      <Field label={text.phone}><input value={form.contactPhone} onChange={(e) => field("contactPhone", e.target.value)} className={inputClass} /></Field>
      <div className="sm:col-span-2"><Field label={text.notes}><textarea rows={5} value={form.notes} onChange={(e) => field("notes", e.target.value)} className={inputClass} /></Field></div>
    </div>
    <label className="flex min-h-11 items-start gap-2 text-sm font-bold"><input type="checkbox" required checked={form.privacyConsent} onChange={(e) => field("privacyConsent", e.target.checked)} className="mt-1" />{text.privacy}</label>
    <button disabled={saving} className="min-h-12 w-full rounded-2xl bg-teal-700 px-4 font-black text-white disabled:opacity-50">{saving ? text.saving : text.submit}</button>
    {message ? <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm font-bold text-teal-900">{message}</p> : null}
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-bold text-slate-700">{label}</span><div className="mt-2">{children}</div></label>; }
const inputClass = "min-h-12 w-full rounded-2xl bg-slate-50 px-3 py-3 text-base outline-none ring-1 ring-slate-200";
const copy = {
  ko: { title: "가게 입점 신청", description: "신청은 검토 대상으로 접수되며 승인되어도 자동으로 검수 완료 장소가 되지 않습니다.", login: "가게 사장님 계정으로 로그인해 신청할 수 있습니다.", ownerOnly: "회원 유형이 ‘가게 사장님’인 계정만 신청할 수 있습니다.", loading: "계정 확인 중", store: "가게명", category: "업종", address: "가게 주소", map: "지도 링크", mapPlaceholder: "지도 URL 또는 앱 공유문", invalidMap: "지원하는 지도 링크를 확인해 주세요.", contact: "담당자명", relationship: "가게와의 관계", email: "연락 이메일", phone: "연락 전화번호", notes: "신청 내용 / 요청사항", privacy: "입점 신청 처리에 필요한 연락처 수집·이용에 동의합니다. (필수)", submit: "입점 신청 접수", saving: "접수 중", success: "입점 신청이 접수되었습니다.", duplicate: "이미 검토 중인 동일 가게 신청이 있습니다.", failed: "신청을 접수하지 못했습니다." },
  zh: { title: "商家入驻申请", description: "申请将进入审核；获批并不代表地点自动通过核验。", login: "请使用商家账号登录后申请。", ownerOnly: "仅‘商家’账号可以申请。", loading: "正在确认账号", store: "店名", category: "行业", address: "店铺地址", map: "地图链接", mapPlaceholder: "地图链接或应用分享文本", invalidMap: "请检查地图链接。", contact: "负责人", relationship: "与店铺的关系", email: "联系邮箱", phone: "联系电话", notes: "申请内容", privacy: "同意为处理申请而收集和使用联系方式（必选）", submit: "提交申请", saving: "提交中", success: "申请已提交。", duplicate: "已有相同店铺的待审申请。", failed: "提交失败。" },
  en: { title: "Business listing application", description: "Applications are reviewed; approval does not automatically mark a place as verified.", login: "Sign in with a business-owner account to apply.", ownerOnly: "Only business-owner accounts can apply.", loading: "Checking account", store: "Business name", category: "Business type", address: "Address", map: "Map link", mapPlaceholder: "Map URL or app share text", invalidMap: "Check the supported map link.", contact: "Contact person", relationship: "Relationship to business", email: "Contact email", phone: "Contact phone", notes: "Request details", privacy: "I consent to contact data use for processing this application. (required)", submit: "Submit application", saving: "Submitting", success: "Application submitted.", duplicate: "An application for this business is already under review.", failed: "Could not submit the application." },
  ja: { title: "店舗掲載申請", description: "申請は審査対象です。承認されても自動的に検証済みにはなりません。", login: "店舗オーナーアカウントでログインしてください。", ownerOnly: "店舗オーナー会員のみ申請できます。", loading: "アカウント確認中", store: "店舗名", category: "業種", address: "住所", map: "地図リンク", mapPlaceholder: "地図URLまたは共有テキスト", invalidMap: "対応する地図リンクを確認してください。", contact: "担当者", relationship: "店舗との関係", email: "連絡メール", phone: "電話番号", notes: "申請内容", privacy: "申請処理のための連絡先収集・利用に同意します。（必須）", submit: "申請する", saving: "送信中", success: "申請を受け付けました。", duplicate: "同一店舗の申請を審査中です。", failed: "申請できませんでした。" },
} satisfies Record<Locale, Record<string, string>>;
