"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, LockKeyhole } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { BusinessPerformance } from "@/lib/business-performance";
import type { PlaceWithRelations } from "@/types/database";
import { downloadReport } from "@/components/AdminBusinessReports";

type ResponseBody = {
  current: BusinessPerformance;
  previous: BusinessPerformance | null;
  changes: Record<string, number | null> | null;
  entitlement: { planCode: string; planName: string; status: string; endsAt: string | null; features: Record<string, boolean> };
  reports: Array<{ id: string; period_start: string; period_end: string; generated_at: string }>;
  limitations: string[];
};

export function BusinessPerformanceDashboard({ accessToken, places, locale }: { accessToken: string; places: PlaceWithRelations[]; locale: Locale }) {
  const text = copy[locale];
  const [placeId, setPlaceId] = useState(places[0]?.id || "");
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(dateInput(daysAgo(29)));
  const [to, setTo] = useState(dateInput(new Date()));
  const [data, setData] = useState<ResponseBody | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!placeId) return;
    setLoading(true); setMessage("");
    try {
      const query = new URLSearchParams({ placeId, from, to });
      const response = await fetch(`/api/business/performance?${query}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || text.loadError);
      setData(body);
    } catch (error) { setMessage(error instanceof Error ? error.message : text.loadError); }
    finally { setLoading(false); }
  }, [accessToken, from, placeId, text.loadError, to]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!placeId && places[0]) setPlaceId(places[0].id); }, [placeId, places]);

  function choosePreset(days: number) {
    setPreset(String(days)); setTo(dateInput(new Date())); setFrom(dateInput(daysAgo(days - 1)));
  }
  const maxViews = useMemo(() => Math.max(1, ...(data?.current.daily.map((item) => item.placeViews) ?? [1])), [data]);
  if (!places.length) return null;
  return <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 className="text-teal-700" size={22} /><h2 className="text-2xl font-black">{text.title}</h2></div><p className="mt-2 text-sm text-slate-600">{text.description}</p></div>{data ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{data.entitlement.planName} · {data.entitlement.status}</span> : null}</div>
    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
      <select className="ui-input" value={placeId} onChange={(event) => setPlaceId(event.target.value)}>{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko}</option>)}</select>
      <div className="flex flex-wrap gap-2">{[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => choosePreset(days)} className={`min-h-11 rounded-xl px-4 text-sm font-black ring-1 ${preset === String(days) ? "bg-teal-700 text-white ring-teal-700" : "bg-white ring-slate-200"}`}>{days}{text.days}</button>)}</div>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label={text.from} className="ui-input" type="date" value={from} onChange={(event) => { setPreset("custom"); setFrom(event.target.value); }} /><input aria-label={text.to} className="ui-input" type="date" value={to} onChange={(event) => { setPreset("custom"); setTo(event.target.value); }} /><button type="button" onClick={() => void load()} className="ui-button-secondary">{text.apply}</button></div>
    {message ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{message}</p> : null}
    {loading ? <p className="mt-5 text-sm font-bold text-slate-500">{text.loading}</p> : data ? <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={text.views} value={data.current.metrics.placeViews.count} change={data.changes?.placeViews} />
        <Metric label={text.unique} value={data.current.metrics.placeViews.unique} change={null} />
        <Metric label={text.saves} value={data.current.metrics.saves.count} suffix={formatRate(data.current.metrics.saveConversionRate)} change={data.changes?.saves} />
        <FeatureMetric enabled={data.entitlement.features.detailed_analytics} label={text.directions} value={data.current.metrics.directions.count} suffix={text.intent} change={data.changes?.directions} />
        <FeatureMetric enabled={data.entitlement.features.detailed_analytics} label={text.phone} value={data.current.metrics.phoneClicks.count} change={data.changes?.phoneClicks} />
        <FeatureMetric enabled={data.entitlement.features.coupon_analytics} label={text.couponViews} value={data.current.metrics.couponViews.count} change={data.changes?.couponViews} />
        <FeatureMetric enabled={data.entitlement.features.coupon_analytics} label={text.couponClaims} value={data.current.metrics.couponClaims.count} suffix={formatRate(data.current.metrics.couponClaimRate)} change={data.changes?.couponClaims} />
        <FeatureMetric enabled={data.entitlement.features.coupon_analytics} label={text.couponRedeems} value={data.current.metrics.couponRedemptions.count} suffix={formatRate(data.current.metrics.couponRedemptionRate)} change={data.changes?.couponRedemptions} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title={text.trend}>{data.current.daily.length ? <div className="flex h-44 items-end gap-1 overflow-x-auto pt-6">{data.current.daily.map((item) => <div key={item.date} title={`${item.date}: ${item.placeViews}`} className="flex min-w-4 flex-1 flex-col items-center justify-end"><div className="w-full rounded-t bg-teal-600" style={{ height: `${Math.max(3, item.placeViews / maxViews * 130)}px` }} /><span className="mt-1 text-[9px] text-slate-500">{item.date.slice(5)}</span></div>)}</div> : <Empty text={text.noData} />}</Panel>
        <Panel title={text.sources}>{data.current.channels.length ? data.current.channels.map((item) => <Row key={item.value} label={item.value} value={item.count} />) : <Empty text={text.noData} />}</Panel>
        <Panel title={text.languages}>{data.current.locales.length ? data.current.locales.map((item) => <Row key={item.value} label={item.value.toUpperCase()} value={item.count} />) : <Empty text={text.noData} />}</Panel>
        <Panel title={text.reports}>{data.entitlement.features.report_download ? data.reports.length ? data.reports.map((report) => <button key={report.id} type="button" className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl bg-slate-50 px-3 text-sm font-bold underline" onClick={() => void downloadReport(report.id, accessToken)}><span>{new Date(report.period_start).toLocaleDateString(locale)} – {new Date(new Date(report.period_end).getTime() - 86_400_000).toLocaleDateString(locale)}</span><span>PDF</span></button>) : <Empty text={text.noReports} /> : <Locked text={text.proRequired} />}</Panel>
      </div>
      <div className="mt-5 rounded-2xl bg-slate-50 p-4"><h3 className="font-black">{text.limits}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">{data.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
    </> : null}
  </section>;
}

function Metric({ label, value, suffix, change }: { label: string; value: number; suffix?: string | null; change: number | null | undefined }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value.toLocaleString()}</p>{suffix ? <p className="mt-1 text-xs font-bold text-teal-700">{suffix}</p> : null}<p className="mt-1 text-xs text-slate-500">{change === null || change === undefined ? "—" : `${change >= 0 ? "+" : ""}${change}%`}</p></div>; }
function FeatureMetric({ enabled, ...props }: { enabled: boolean; label: string; value: number; suffix?: string | null; change: number | null | undefined }) { return enabled ? <Metric {...props} /> : <div className="rounded-2xl bg-slate-50 p-4 text-slate-500"><LockKeyhole size={17} /><p className="mt-2 text-xs font-bold">{props.label}</p><p className="mt-1 text-sm">Pro</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-slate-200 p-4"><h3 className="font-black">{title}</h3>{children}</div>; }
function Row({ label, value }: { label: string; value: number }) { return <p className="mt-2 flex justify-between gap-3 text-sm"><span>{label}</span><strong>{value.toLocaleString()}</strong></p>; }
function Empty({ text }: { text: string }) { return <p className="mt-3 text-sm text-slate-500">{text}</p>; }
function Locked({ text }: { text: string }) { return <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><LockKeyhole size={15} />{text}</p>; }
function formatRate(value: number | null) { return value === null ? null : `${value}%`; }
function daysAgo(days: number) { return new Date(Date.now() - days * 86_400_000); }
function dateInput(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date); }

const copy = {
  ko: { title: "가게 성과", description: "조회·저장·연락·쿠폰 전환을 실제 수집 데이터로 확인합니다.", days: "일", from: "시작일", to: "종료일", apply: "조회", loading: "성과를 불러오는 중입니다.", loadError: "성과 데이터를 불러오지 못했습니다.", views: "장소 상세 조회", unique: "고유 조회자", saves: "저장", directions: "길찾기 클릭", phone: "전화 클릭", intent: "방문 의향 지표", couponViews: "쿠폰 상세 확인", couponClaims: "쿠폰 발급", couponRedeems: "쿠폰 사용", trend: "조회 추이", sources: "유입 경로", languages: "언어별 비중", reports: "저장된 리포트", noReports: "관리자가 생성한 리포트가 없습니다.", proRequired: "리포트 다운로드 권한이 필요한 기능입니다.", limits: "데이터 기준과 한계", noData: "데이터 없음" },
  zh: { title: "店铺成效", description: "根据实际收集的数据查看浏览、收藏、联系和优惠券转化。", days: "天", from: "开始日期", to: "结束日期", apply: "查询", loading: "正在加载成效。", loadError: "无法加载成效数据。", views: "地点详情浏览", unique: "独立访客", saves: "收藏", directions: "路线点击", phone: "电话点击", intent: "到访意向指标", couponViews: "优惠券详情", couponClaims: "领取优惠券", couponRedeems: "实际核销", trend: "浏览趋势", sources: "来源渠道", languages: "语言占比", reports: "已保存报告", noReports: "管理员尚未生成报告。", proRequired: "需要报告下载权限。", limits: "数据口径与限制", noData: "暂无数据" },
  en: { title: "Store performance", description: "Review views, saves, contact intent, and coupon conversions from collected data.", days: " days", from: "From", to: "To", apply: "Apply", loading: "Loading performance.", loadError: "Could not load performance data.", views: "Place detail views", unique: "Unique viewers", saves: "Saves", directions: "Directions clicks", phone: "Phone clicks", intent: "Visit-intent signal", couponViews: "Coupon details", couponClaims: "Coupon claims", couponRedeems: "Coupon redemptions", trend: "View trend", sources: "Acquisition sources", languages: "Languages", reports: "Saved reports", noReports: "No report has been generated by an administrator.", proRequired: "Report download entitlement is required.", limits: "Definitions and limitations", noData: "No data" },
  ja: { title: "店舗パフォーマンス", description: "収集済みデータから閲覧・保存・連絡・クーポン転換を確認します。", days: "日", from: "開始日", to: "終了日", apply: "表示", loading: "データを読み込んでいます。", loadError: "データを読み込めませんでした。", views: "詳細閲覧", unique: "ユニーク閲覧者", saves: "保存", directions: "経路クリック", phone: "電話クリック", intent: "来店意向の指標", couponViews: "クーポン詳細", couponClaims: "クーポン発行", couponRedeems: "クーポン使用", trend: "閲覧推移", sources: "流入元", languages: "言語比率", reports: "保存済みレポート", noReports: "管理者が作成したレポートはありません。", proRequired: "レポートのダウンロード権限が必要です。", limits: "データ定義と制限", noData: "データなし" },
} satisfies Record<Locale, Record<string, string>>;
