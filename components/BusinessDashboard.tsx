"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPlaceManager } from "@/components/AdminPlaceManager";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { withLocale, type Locale } from "@/lib/i18n";
import type { BusinessApplicationRecord, BusinessPlaceChangeRecord, BusinessPlaceMembershipRecord, PlaceWithRelations } from "@/types/database";

type DashboardData = {
  applications: BusinessApplicationRecord[];
  memberships: BusinessPlaceMembershipRecord[];
  changes: BusinessPlaceChangeRecord[];
  places: PlaceWithRelations[];
};

export function BusinessDashboard({ locale }: { locale: Locale }) {
  const { session, loading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const load = useCallback(async () => {
    if (!session?.access_token) return;
    const response = await fetch("/api/business/dashboard", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "대시보드를 불러오지 못했습니다.");
    setData(body); setMessage("");
  }, [session?.access_token]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <State text={copy[locale].loading} />;
  if (!session) return <AuthRequiredPanel title={copy[locale].title} description={copy[locale].login} locale={locale} />;
  if (message) return <State text={message} />;
  if (!data) return <State text={copy[locale].loading} />;

  const approved = data.applications.filter((application) => application.status === "approved");
  const application = approved.find((item) => item.id === selectedApplicationId)
    ?? approved.find((item) => !item.linked_place_id)
    ?? approved[0];
  const selectedChanges = application ? data.changes.filter((change) => change.application_id === application.id) : [];
  const selectedMemberships = application ? data.memberships.filter((membership) => membership.source_application_id === application.id) : [];
  const selectedPlaceIds = new Set([application?.linked_place_id, ...selectedMemberships.map((membership) => membership.place_id)].filter(Boolean));
  const selectedPlaces = data.places.filter((place) => selectedPlaceIds.has(place.id));
  const pendingReview = selectedChanges.find((change) => change.status === "pending_review");
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-black">{copy[locale].title}</h2>
        <p className="mt-2 text-sm text-slate-600">{copy[locale].description}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.applications.map((item) => <article key={item.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-black">{applicationName(item, locale)}</h3><Status value={item.status} locale={locale} /></div>{item.map_url ? <a href={item.map_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-bold text-teal-800 underline">Naver Place</a> : <p className="mt-2 text-sm text-slate-600">{item.address}</p>}{item.status === "rejected" && item.admin_notes ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{copy[locale].rejected}: {item.admin_notes}</p> : null}{item.status === "more_info_requested" && item.admin_notes ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{item.admin_notes}</p> : null}</article>)}
        </div>
        {!data.applications.length || data.applications.every((item) => item.status === "rejected") ? <Link href={withLocale("/business-application", locale)} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 text-sm font-black text-white">{copy[locale].apply}</Link> : null}
      </section>

      {approved.length ? <section className="rounded-[28px] bg-indigo-50 p-4 text-sm font-bold text-indigo-950 ring-1 ring-indigo-100"><p>{copy[locale].reviewNotice}</p><div className="mt-2 flex flex-wrap gap-2">{data.changes.map((change) => <span key={change.id} className="rounded-full bg-white px-3 py-1 ring-1 ring-indigo-100">{change.place_id ? copy[locale].edit : copy[locale].newPlace}: {changeStatus(change.status, locale)}{(change.status === "rejected" || change.status === "changes_requested") && change.rejection_reason ? ` · ${change.rejection_reason}` : ""}</span>)}</div></section> : null}

      {approved.length > 1 ? <section className="flex flex-wrap gap-2">{approved.map((item) => <button key={item.id} type="button" onClick={() => setSelectedApplicationId(item.id)} className={`min-h-11 rounded-xl px-4 text-sm font-black ring-1 ${application?.id === item.id ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-800 ring-slate-200"}`}>{item.store_name}</button>)}</section> : null}

      {pendingReview ? <section className="rounded-[28px] bg-amber-50 p-5 ring-1 ring-amber-200"><h3 className="font-black text-amber-950">{copy[locale].underReview}</h3><p className="mt-2 text-sm text-amber-900">{copy[locale].underReviewDetail}</p></section> : application ? <AdminPlaceManager
        mode="business"
        initialPlaces={selectedPlaces}
        source="supabase"
        supabaseConfigured
        adminAccessToken={session.access_token}
        businessApplicationId={application.id}
        businessChanges={selectedChanges}
        onBusinessSaved={load}
        allowNewBusinessPlace={!application.linked_place_id}
      /> : <section className="rounded-[28px] bg-amber-50 p-5 font-bold text-amber-950">{copy[locale].waiting}</section>}
    </div>
  );
}

function State({ text }: { text: string }) { return <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className="font-bold text-slate-700">{text}</p></section>; }
function Status({ value, locale }: { value: BusinessApplicationRecord["status"]; locale: Locale }) { const label = ({ ko: { pending: "접수", reviewing: "검토 중", more_info_requested: "추가 정보 요청", approved: "승인", rejected: "반려" }, zh: { pending: "已提交", reviewing: "审核中", more_info_requested: "需要补充", approved: "已批准", rejected: "已拒绝" }, en: { pending: "Submitted", reviewing: "Under review", more_info_requested: "More information", approved: "Approved", rejected: "Rejected" }, ja: { pending: "受付済み", reviewing: "確認中", more_info_requested: "追加情報", approved: "承認", rejected: "却下" } } as const)[locale][value]; return <span className="rounded-full bg-white px-2 py-1 text-xs font-black ring-1 ring-slate-200">{label}</span>; }
function applicationName(item: BusinessApplicationRecord, locale: Locale) { return item.store_name === "네이버 플레이스 업체" ? ({ ko: "네이버 플레이스 입점신청", zh: "Naver Place 入驻申请", en: "Naver Place application", ja: "Naver Place 掲載申請" } as const)[locale] : item.store_name; }
function changeStatus(value: BusinessPlaceChangeRecord["status"], locale: Locale) { return ({ ko: { draft: "정보 작성 중", pending_review: "관리자 검수 중", changes_requested: "보완 요청", approved: "가게 공개 완료", rejected: "반려" }, zh: { draft: "信息填写中", pending_review: "管理员审核中", changes_requested: "需要补充", approved: "店铺已公开", rejected: "已拒绝" }, en: { draft: "Draft", pending_review: "Under review", changes_requested: "Changes requested", approved: "Published", rejected: "Rejected" }, ja: { draft: "情報入力中", pending_review: "管理者審査中", changes_requested: "修正依頼", approved: "公開完了", rejected: "却下" } } as const)[locale][value]; }

const copy = {
  ko: { title: "내 가게 관리", description: "입점 승인 완료 후 가게 정보를 작성하고 검수를 요청할 수 있습니다.", loading: "사업자 권한과 업체 정보를 확인하고 있습니다.", login: "로그인 후 입점 신청 상태와 내 가게를 관리할 수 있습니다.", rejected: "반려 사유", apply: "입점 다시 신청", reviewNotice: "임시 저장과 검수 중 정보는 공개되지 않으며, 최종 승인 후에만 사용자 사이트에 반영됩니다.", waiting: "입점 승인 후 ‘가게 정보 작성하기’를 사용할 수 있습니다.", edit: "정보 수정 요청", newPlace: "가게 정보 작성", underReview: "관리자 검수 중", underReviewDetail: "제출 버전은 수정할 수 없습니다. 보완 요청 또는 최종 승인 결과를 기다려 주세요." },
  zh: { title: "我的店铺管理", description: "入驻获批后填写店铺信息并提交审核。", loading: "正在确认商家权限和店铺信息。", login: "登录后可查看申请状态并管理店铺。", rejected: "拒绝原因", apply: "重新申请", reviewNotice: "草稿和审核中的信息不会公开，最终批准后才会显示。", waiting: "入驻获批后即可填写店铺信息。", edit: "申请修改信息", newPlace: "填写店铺信息", underReview: "管理员审核中", underReviewDetail: "审核中的版本无法修改，请等待补充要求或最终结果。" },
  en: { title: "My business", description: "Complete your store details after admission approval and submit them for review.", loading: "Checking business access and stores.", login: "Sign in to view your application and manage your business.", rejected: "Reason", apply: "Apply again", reviewNotice: "Draft and under-review information stays private until final approval.", waiting: "You can complete store information after admission approval.", edit: "Request an update", newPlace: "Complete store details", underReview: "Under administrator review", underReviewDetail: "This submitted version is locked until approval or a changes request." },
  ja: { title: "店舗管理", description: "入店承認後、店舗情報を入力して審査を依頼できます。", loading: "店舗権限を確認しています。", login: "ログイン後、申請状況と店舗を管理できます。", rejected: "却下理由", apply: "再申請", reviewNotice: "下書きと審査中の情報は非公開で、最終承認後に反映されます。", waiting: "入店承認後に店舗情報を入力できます。", edit: "情報修正を申請", newPlace: "店舗情報を入力", underReview: "管理者審査中", underReviewDetail: "提出済みバージョンは審査結果または修正依頼まで編集できません。" },
} satisfies Record<Locale, Record<string, string>>;
