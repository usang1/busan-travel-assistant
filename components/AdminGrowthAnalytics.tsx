"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, LocateFixed, MapPinCheck, Navigation, Phone, QrCode, Search } from "lucide-react";
import type { PlaceWithRelations } from "@/types/database";

type AnalyticsData = {
  visitors: number | null;
  totalEvents: number;
  truncated: boolean;
  metrics: Record<string, number | null>;
  channels: Array<{ value: string; count: number; visitors: number }>;
  locales: Array<{ value: string; count: number; visitors: number }>;
  devices: Array<{ value: string; count: number; visitors: number }>;
  sources: Array<{ value: string; count: number; visitors: number }>;
  daily: Array<{ date: string; events: number; visitors: number; placeViews: number; directions: number; couponRedemptions: number }>;
  popularPlaces: Array<{ placeId: string; views: number; saves: number; directions: number; couponRedemptions: number }>;
  campaigns: Array<{ campaignId: string; visitors: number; placeViews: number; directions: number; couponRedemptions: number }>;
  message?: string;
  aggregation?: "raw" | "daily";
  aggregateUpdatedAt?: string | null;
  limitations?: string[];
};

export function AdminGrowthAnalytics({ accessToken, places }: { accessToken: string; places: PlaceWithRelations[] }) {
  const [range, setRange] = useState(() => defaultRange());
  const [placeId, setPlaceId] = useState("");
  const [channel, setChannel] = useState("");
  const [device, setDevice] = useState("");
  const [source, setSource] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const placeNames = useMemo(() => new Map(places.map((place) => [place.id, place.name_ko || place.name_zh])), [places]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (placeId) params.set("placeId", placeId);
      if (channel) params.set("channel", channel);
      if (device) params.set("device", device);
      if (source) params.set("source", source);
      try {
        const response = await fetch(`/api/admin/analytics?${params}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal });
        const body = await response.json() as AnalyticsData;
        if (!response.ok) throw new Error(body.message || "성과 데이터를 불러오지 못했습니다.");
        setData(body);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "성과 데이터를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accessToken, channel, device, placeId, range, source]);

  async function downloadCsv() {
    const params = new URLSearchParams({ from: range.from, to: range.to, format: "csv" });
    if (placeId) params.set("placeId", placeId);
    if (channel) params.set("channel", channel);
    if (device) params.set("device", device);
    if (source) params.set("source", source);
    const response = await fetch(`/api/admin/analytics?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return setError("CSV를 내려받지 못했습니다.");
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `spotzari-analytics-${range.from}-${range.to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function refreshDailyStats() {
    setError("");
    const response = await fetch("/api/admin/analytics/refresh", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(range) });
    const body = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) return setError(body.message || "일별 집계를 갱신하지 못했습니다.");
    setRange((current) => ({ ...current }));
  }

  return (
    <section id="growth-analytics" className="scroll-mt-24 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Growth analytics</p><h2 className="mt-1 text-2xl font-black text-slate-950">유입·장소·방문 의도 성과</h2><p className="mt-2 text-sm text-slate-600">조회, 저장, 길찾기, 쿠폰 확인을 서로 다른 단계로 집계합니다.</p></div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="h-11 rounded-xl px-3 ring-1 ring-slate-200" />
          <input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="h-11 rounded-xl px-3 ring-1 ring-slate-200" />
          <select value={placeId} onChange={(event) => setPlaceId(event.target.value)} className="h-11 rounded-xl px-3 ring-1 ring-slate-200"><option value="">모든 장소</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko}</option>)}</select>
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 rounded-xl px-3 ring-1 ring-slate-200"><option value="">모든 채널</option>{["xiaohongshu", "instagram", "naver_blog", "google_search", "stay_qr", "place_qr", "direct", "other"].map((value) => <option key={value} value={value}>{channelLabel(value)}</option>)}</select>
          <select value={device} onChange={(event) => setDevice(event.target.value)} className="h-11 rounded-xl px-3 ring-1 ring-slate-200"><option value="">모든 기기</option><option value="mobile">모바일</option><option value="tablet">태블릿</option><option value="desktop">PC</option></select>
          <input value={source} onChange={(event) => setSource(event.target.value.replace(/[^a-z0-9._-]/giu, "").slice(0, 80))} placeholder="유입 소스" className="h-11 rounded-xl px-3 ring-1 ring-slate-200" />
          <button type="button" onClick={() => void downloadCsv()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Download size={16} />CSV</button>
          <button type="button" onClick={() => void refreshDailyStats()} className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-black text-white">일별 집계 갱신</button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}
      {loading ? <p className="mt-5 text-sm font-bold text-slate-500">성과 데이터를 집계하는 중입니다.</p> : data ? <>
        {data.truncated ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">이 기간은 이벤트 20,000건까지만 집계했습니다. 분석 RPC 또는 데이터 웨어하우스 연결이 필요합니다.</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">{[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => setRange(presetRange(days))} className="min-h-10 rounded-xl bg-slate-50 px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200">최근 {days}일</button>)}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric icon={BarChart3} label={data.visitors === null ? "고유 방문자*" : "고유 방문자"} value={data.visitors ?? "집계 특성상 미표시"} />
          <Metric icon={BarChart3} label="페이지 조회" value={metric(data, "pageViews")} />
          <Metric icon={Search} label="장소 상세" value={metric(data, "placeViews")} />
          <Metric icon={Search} label={data.aggregation === "daily" ? "일별 고유 조회 합계" : "장소 고유 조회"} value={metric(data, "uniquePlaceViews")} />
          <Metric icon={MapPinCheck} label="저장 전환율" value={percent(data.metrics.saveConversionRate)} />
          <Metric icon={Navigation} label="길찾기 클릭" value={metric(data, "directions")} />
          <Metric icon={Phone} label="전화 클릭" value={metric(data, "phoneClicks")} />
          <Metric icon={QrCode} label="QR 유입" value={metric(data, "stayQrLandings")} />
          <Metric icon={LocateFixed} label="위치 성공률" value={percent(data.metrics.locationSuccessRate)} />
          <Metric icon={MapPinCheck} label="쿠폰 사용 확인" value={metric(data, "couponRedemptions")} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Panel title="유입 채널">{data.channels.length ? data.channels.map((item) => <Row key={item.value} label={channelLabel(item.value)} value={`${item.visitors}명 · ${item.count}회`} />) : <Empty />}</Panel>
          <Panel title="인기 장소">{data.popularPlaces.length ? data.popularPlaces.slice(0, 8).map((item) => <Row key={item.placeId} label={placeNames.get(item.placeId) || item.placeId} value={`조회 ${item.views} · 길찾기 ${item.directions}`} />) : <Empty />}</Panel>
          <Panel title="자동 입력·좌표 품질"><Row label="자동 장소 검색" value={`${metric(data, "importSearches")}회`} /><Row label="자동 정보 적용" value={`${metric(data, "importApplied")}회`} /><Row label="주소 검색" value={`${metric(data, "addressSearches")}회`} /><Row label="좌표 저장 실패" value={`${metric(data, "coordinateSaveFailures")}회`} /></Panel>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel title="언어 비중">{data.locales?.length ? data.locales.map((item) => <Row key={item.value} label={item.value.toUpperCase()} value={`${item.count}회`} />) : <Empty />}</Panel>
          <Panel title="기기 비중">{data.devices?.length ? data.devices.map((item) => <Row key={item.value} label={deviceLabel(item.value)} value={`${item.count}회`} />) : <Empty />}</Panel>
          <Panel title="쿠폰 퍼널"><Row label="쿠폰 확인" value={`${metric(data, "couponViews")}회`} /><Row label="쿠폰 발급" value={`${metric(data, "couponIssues")}회`} /><Row label="쿠폰 사용 확인" value={`${metric(data, "couponRedemptions")}회`} /></Panel>
        </div>
        <Panel title="일별 추이"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="p-2">날짜</th><th className="p-2">전체 이벤트</th><th className="p-2">고유 방문</th><th className="p-2">장소 조회</th><th className="p-2">길찾기</th><th className="p-2">쿠폰 사용</th></tr></thead><tbody>{data.daily.map((item) => <tr key={item.date} className="border-t border-slate-100"><td className="p-2 font-bold">{item.date}</td><td className="p-2">{item.events}</td><td className="p-2">{item.visitors}</td><td className="p-2">{item.placeViews}</td><td className="p-2">{item.directions}</td><td className="p-2">{item.couponRedemptions}</td></tr>)}</tbody></table></div></Panel>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><p className="font-black text-slate-800">지표 정의와 한계</p><p className="mt-1">조회수는 중복 제거 후 수집된 이벤트 수, 고유 방문자는 로그인 계정 또는 익명 세션 기준입니다. 저장 전환율은 장소 조회 대비 저장 이벤트입니다. 길찾기·전화·쿠폰 발급은 방문 의도이며 실제 방문이나 결제가 아닙니다.</p>{data.limitations?.map((item) => <p key={item}>• {item}</p>)}</div>
      </> : null}
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: number | string }) { return <div className="rounded-2xl bg-slate-50 p-4"><Icon size={18} className="text-teal-700" aria-hidden="true" /><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-[22px] bg-slate-50 p-4"><h3 className="font-black text-slate-950">{title}</h3><div className="mt-3 space-y-2">{children}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"><span className="min-w-0 truncate font-bold text-slate-700">{label}</span><span className="shrink-0 font-black text-slate-950">{value}</span></div>; }
function Empty() { return <p className="text-sm text-slate-500">이 기간에 집계할 데이터가 없습니다.</p>; }
function metric(data: AnalyticsData, key: string) { return Number(data.metrics[key] || 0); }
function percent(value: number | null | undefined) { return value === null || value === undefined ? "데이터 없음" : `${value}%`; }
function channelLabel(value: string) { return ({ xiaohongshu: "샤오홍슈", instagram: "인스타그램", naver_blog: "네이버 블로그", google_search: "Google 검색", stay_qr: "숙소 QR", place_qr: "가게 QR", direct: "직접 방문", other: "기타", unknown: "미분류" } as Record<string, string>)[value] || value; }
function deviceLabel(value: string) { return ({ mobile: "모바일", tablet: "태블릿", desktop: "PC", unknown: "미분류" } as Record<string, string>)[value] || value; }
function defaultRange() { const to = new Date(); const from = new Date(to.getTime() - 29 * 86_400_000); return { from: dateInput(from), to: dateInput(to) }; }
function presetRange(days: number) { const to = new Date(); const from = new Date(to.getTime() - (days - 1) * 86_400_000); return { from: dateInput(from), to: dateInput(to) }; }
function dateInput(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
