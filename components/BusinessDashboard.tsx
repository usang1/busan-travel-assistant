"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { BusinessCouponManager } from "@/components/BusinessCouponManager";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { withLocale, type Locale } from "@/lib/i18n";
import type { BusinessApplicationRecord, BusinessPlaceChangeRecord, BusinessPlaceMembershipRecord, PlaceWithRelations } from "@/types/database";

const AdminPlaceManager = dynamic(() => import("@/components/AdminPlaceManager").then((module) => module.AdminPlaceManager));

type DashboardData = {
  applications: BusinessApplicationRecord[];
  memberships: BusinessPlaceMembershipRecord[];
  changes: BusinessPlaceChangeRecord[];
  places: PlaceWithRelations[];
  analytics?: {
    current: BusinessAnalyticsRow[];
    previous: BusinessAnalyticsRow[];
    unavailable: boolean;
  };
};

type BusinessAnalyticsRow = { place_id: string; event_type: string; channel: string; locale: string; event_count: number | string; visitor_count: number | string };

export function BusinessDashboard({ locale }: { locale: Locale }) {
  const { session, loading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const errorCopy = {
    ko: { message: "업체 정보를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.", retry: "다시 시도" },
    zh: { message: "无法加载店铺信息。请检查网络连接后重试。", retry: "重试" },
    en: { message: "Could not load your business details. Check your connection and try again.", retry: "Try again" },
    ja: { message: "店舗情報を読み込めませんでした。接続を確認して再度お試しください。", retry: "再試行" },
  }[locale];
  const load = useCallback(async () => {
    if (!session?.access_token) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setMessage("");
    setData(null);
    try {
      const response = await fetch("/api/business/dashboard", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error("Dashboard unavailable");
      if (activeRequest.current === controller) setData(body);
    } catch {
      if (activeRequest.current === controller) setMessage(errorCopy.message);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [errorCopy.message, session?.access_token]);
  useEffect(() => {
    void load();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [load]);

  if (loading) return <State text={copy[locale].loading} />;
  if (!session) return <AuthRequiredPanel title={copy[locale].title} description={copy[locale].login} locale={locale} />;
  if (message) return <section role="alert" className="space-y-4 rounded-[28px] bg-white p-6 ring-1 ring-slate-200"><p>{message}</p><button type="button" onClick={() => void load()} className="ui-button-primary">{errorCopy.retry}</button></section>;
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

      {application && !pendingReview ? <section className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-teal-50 p-4 ring-1 ring-teal-100"><div><h3 className="font-black text-teal-950">{copy[locale].approvedTitle}</h3><p className="mt-1 text-sm text-teal-900">{copy[locale].approvedDetail}</p></div><Link href="#place-manager" className="inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-4 text-sm font-black text-white">{selectedPlaces.length || application.linked_place_id ? copy[locale].edit : copy[locale].newPlace}</Link></section> : null}

      {selectedPlaces.length ? <BusinessCouponManager accessToken={session.access_token} places={selectedPlaces} locale={locale} /> : null}
      {selectedPlaces.length && data.analytics ? <BusinessPerformance analytics={data.analytics} placeIds={selectedPlaceIds} locale={locale} /> : null}

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
function BusinessPerformance({ analytics, placeIds, locale }: { analytics: NonNullable<DashboardData["analytics"]>; placeIds: Set<string | null | undefined>; locale: Locale }) {
  const rows = analytics.current.filter((row) => placeIds.has(row.place_id));
  const previous = analytics.previous.filter((row) => placeIds.has(row.place_id));
  const text = performanceCopy[locale];
  const metrics = [
    { label: text.views, types: ["place_view", "place_opened"] },
    { label: text.saves, types: ["place_save", "place_saved"] },
    { label: text.directions, types: ["directions_click"] },
    { label: text.couponIssues, types: ["coupon_issued"] },
    { label: text.couponRedemptions, types: ["coupon_redeemed"] },
    { label: text.location, types: ["location_succeeded"] },
  ];
  const channels = Array.from(new Set(rows.map((row) => row.channel))).map((channel) => ({ channel, count: sumRows(rows.filter((row) => row.channel === channel), ["place_view", "place_opened", "directions_click", "coupon_redeemed"]) })).sort((a, b) => b.count - a.count);
  const localeRows = Array.from(new Set(rows.map((row) => row.locale))).map((value) => ({ value, count: sumRows(rows.filter((row) => row.locale === value), ["place_view", "place_opened"]) })).sort((a, b) => b.count - a.count);
  return <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200"><h2 className="text-2xl font-black">{text.title}</h2><p className="mt-2 text-sm text-slate-600">{text.description}</p>{analytics.unavailable ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{text.unavailable}</p> : <><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{metrics.map((metric) => { const value = sumRows(rows, metric.types); const previousValue = sumRows(previous, metric.types); return <div key={metric.label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{metric.label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{periodChange(value, previousValue, text)}</p></div>; })}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black">{text.channels}</h3>{channels.length ? channels.map((item) => <p key={item.channel} className="mt-2 flex justify-between text-sm"><span>{item.channel}</span><strong>{item.count}</strong></p>) : <p className="mt-2 text-sm text-slate-500">{text.noData}</p>}</div><div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black">{text.languages}</h3>{localeRows.length ? localeRows.map((item) => <p key={item.value} className="mt-2 flex justify-between text-sm"><span>{item.value.toUpperCase()}</span><strong>{item.count}</strong></p>) : <p className="mt-2 text-sm text-slate-500">{text.noData}</p>}</div></div></>}</section>;
}
function sumRows(rows: BusinessAnalyticsRow[], types: string[]) { return rows.filter((row) => types.includes(row.event_type)).reduce((sum, row) => sum + Number(row.event_count || 0), 0); }
function periodChange(value: number, previous: number, text: typeof performanceCopy[Locale]) { if (!previous) return text.noComparison; const rate = Math.round(((value - previous) / previous) * 100); return `${text.previous} ${rate >= 0 ? "+" : ""}${rate}%`; }
function Status({ value, locale }: { value: BusinessApplicationRecord["status"]; locale: Locale }) { const label = ({ ko: { pending: "접수", reviewing: "검토 중", more_info_requested: "추가 정보 요청", approved: "승인", rejected: "반려" }, zh: { pending: "已提交", reviewing: "审核中", more_info_requested: "需要补充", approved: "已批准", rejected: "已拒绝" }, en: { pending: "Submitted", reviewing: "Under review", more_info_requested: "More information", approved: "Approved", rejected: "Rejected" }, ja: { pending: "受付済み", reviewing: "確認中", more_info_requested: "追加情報", approved: "承認", rejected: "却下" } } as const)[locale][value]; return <span className="rounded-full bg-white px-2 py-1 text-xs font-black ring-1 ring-slate-200">{label}</span>; }
function applicationName(item: BusinessApplicationRecord, locale: Locale) { return item.store_name === "네이버 플레이스 업체" ? ({ ko: "네이버 플레이스 입점신청", zh: "Naver Place 入驻申请", en: "Naver Place application", ja: "Naver Place 掲載申請" } as const)[locale] : item.store_name; }
function changeStatus(value: BusinessPlaceChangeRecord["status"], locale: Locale) { return ({ ko: { draft: "정보 작성 중", pending_review: "관리자 검수 중", changes_requested: "보완 요청", approved: "가게 공개 완료", rejected: "반려" }, zh: { draft: "信息填写中", pending_review: "管理员审核中", changes_requested: "需要补充", approved: "店铺已公开", rejected: "已拒绝" }, en: { draft: "Draft", pending_review: "Under review", changes_requested: "Changes requested", approved: "Published", rejected: "Rejected" }, ja: { draft: "情報入力中", pending_review: "管理者審査中", changes_requested: "修正依頼", approved: "公開完了", rejected: "却下" } } as const)[locale][value]; }

const copy = {
  ko: { title: "내 가게 관리", description: "입점 승인 완료 후 가게 정보를 작성하고 검수를 요청할 수 있습니다.", loading: "사업자 권한과 업체 정보를 확인하고 있습니다.", login: "로그인 후 입점 신청 상태와 내 가게를 관리할 수 있습니다.", rejected: "반려 사유", apply: "입점 다시 신청", reviewNotice: "임시 저장과 검수 중 정보는 공개되지 않으며, 최종 승인 후에만 사용자 사이트에 반영됩니다.", waiting: "입점 승인 후 ‘가게 정보 작성하기’를 사용할 수 있습니다.", edit: "정보 수정 요청", newPlace: "가게 정보 작성하기", underReview: "관리자 검수 중", underReviewDetail: "제출 버전은 수정할 수 없습니다. 보완 요청 또는 최종 승인 결과를 기다려 주세요.", approvedTitle: "입점 승인이 완료되었습니다", approvedDetail: "아래 버튼에서 가게 정보를 작성하거나 기존 정보를 수정할 수 있습니다." },
  zh: { title: "我的店铺管理", description: "入驻获批后填写店铺信息并提交审核。", loading: "正在确认商家权限和店铺信息。", login: "登录后可查看申请状态并管理店铺。", rejected: "拒绝原因", apply: "重新申请", reviewNotice: "草稿和审核中的信息不会公开，最终批准后才会显示。", waiting: "入驻获批后即可填写店铺信息。", edit: "申请修改信息", newPlace: "填写店铺信息", underReview: "管理员审核中", underReviewDetail: "审核中的版本无法修改，请等待补充要求或最终结果。", approvedTitle: "入驻申请已获批准", approvedDetail: "点击下方按钮填写店铺资料或修改现有信息。" },
  en: { title: "My business", description: "Complete your store details after admission approval and submit them for review.", loading: "Checking business access and stores.", login: "Sign in to view your application and manage your business.", rejected: "Reason", apply: "Apply again", reviewNotice: "Draft and under-review information stays private until final approval.", waiting: "You can complete store information after admission approval.", edit: "Request an update", newPlace: "Complete store details", underReview: "Under administrator review", underReviewDetail: "This submitted version is locked until approval or a changes request.", approvedTitle: "Your application is approved", approvedDetail: "Use the button below to enter or update your store information." },
  ja: { title: "店舗管理", description: "入店承認後、店舗情報を入力して審査を依頼できます。", loading: "店舗権限を確認しています。", login: "ログイン後、申請状況と店舗を管理できます。", rejected: "却下理由", apply: "再申請", reviewNotice: "下書きと審査中の情報は非公開で、最終承認後に反映されます。", waiting: "入店承認後に店舗情報を入力できます。", edit: "情報修正を申請", newPlace: "店舗情報を入力", underReview: "管理者審査中", underReviewDetail: "提出済みバージョンは審査結果または修正依頼まで編集できません。", approvedTitle: "入店申請が承認されました", approvedDetail: "下のボタンから店舗情報を入力・編集できます。" },
} satisfies Record<Locale, Record<string, string>>;

const performanceCopy = {
  ko: { title: "최근 30일 성과", description: "조회·저장·길찾기·쿠폰 발급·사용을 구분합니다. 길찾기는 실제 방문으로 간주하지 않습니다.", unavailable: "사업자 통계 DB 마이그레이션(052) 적용 후 집계가 표시됩니다.", views: "장소 조회", saves: "저장", directions: "길찾기", couponIssues: "쿠폰 발급", couponRedemptions: "쿠폰 사용", location: "위치 기반 유입", channels: "의도 행동 유입 채널", languages: "장소 조회 언어", noData: "집계 데이터 없음", previous: "이전 30일 대비", noComparison: "이전 기간 데이터 없음" },
  zh: { title: "近30天成效", description: "分别统计浏览、收藏、路线、领券与核销。路线点击不等于实际到店。", unavailable: "应用商家统计数据库迁移（052）后显示数据。", views: "地点浏览", saves: "收藏", directions: "路线点击", couponIssues: "领券", couponRedemptions: "核销", location: "位置来源", channels: "高意向行为渠道", languages: "浏览语言", noData: "暂无数据", previous: "较前30天", noComparison: "前期无数据" },
  en: { title: "Last 30 days", description: "Views, saves, directions, coupon issues, and redemptions are separate. Directions are not counted as visits.", unavailable: "Apply business analytics migration 052 to show aggregates.", views: "Place views", saves: "Saves", directions: "Directions", couponIssues: "Coupons issued", couponRedemptions: "Coupons redeemed", location: "Location-driven", channels: "Intent channels", languages: "View languages", noData: "No data", previous: "vs prior 30 days", noComparison: "No prior-period data" },
  ja: { title: "直近30日間の成果", description: "閲覧・保存・経路・クーポン発行・使用を分けて集計します。経路クリックは実来店ではありません。", unavailable: "事業者分析DBマイグレーション（052）適用後に表示されます。", views: "スポット閲覧", saves: "保存", directions: "経路クリック", couponIssues: "クーポン発行", couponRedemptions: "クーポン使用", location: "位置情報経由", channels: "意向行動チャネル", languages: "閲覧言語", noData: "データなし", previous: "前30日比", noComparison: "前期間データなし" },
} satisfies Record<Locale, Record<string, string>>;
