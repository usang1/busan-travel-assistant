"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, LocateFixed, MapPinCheck, Navigation, QrCode, Search } from "lucide-react";
import type { PlaceWithRelations } from "@/types/database";

type AnalyticsData = {
  visitors: number;
  totalEvents: number;
  truncated: boolean;
  metrics: Record<string, number | null>;
  channels: Array<{ value: string; count: number; visitors: number }>;
  daily: Array<{ date: string; events: number; visitors: number; placeViews: number; directions: number; couponRedemptions: number }>;
  popularPlaces: Array<{ placeId: string; views: number; saves: number; directions: number; couponRedemptions: number }>;
  campaigns: Array<{ campaignId: string; visitors: number; placeViews: number; directions: number; couponRedemptions: number }>;
  message?: string;
};

export function AdminGrowthAnalytics({ accessToken, places }: { accessToken: string; places: PlaceWithRelations[] }) {
  const [range, setRange] = useState(() => defaultRange());
  const [placeId, setPlaceId] = useState("");
  const [channel, setChannel] = useState("");
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
  }, [accessToken, channel, placeId, range]);

  return (
    <section id="growth-analytics" className="scroll-mt-24 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Growth analytics</p><h2 className="mt-1 text-2xl font-black text-slate-950">유입·장소·방문 의도 성과</h2><p className="mt-2 text-sm text-slate-600">조회, 저장, 길찾기, 쿠폰 확인을 서로 다른 단계로 집계합니다.</p></div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="h-11 rounded-xl px-3 ring-1 ring-slate-200" />
          <input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="h-11 rounded-xl px-3 ring-1 ring-slate-200" />
          <select value={placeId} onChange={(event) => setPlaceId(event.target.value)} className="h-11 rounded-xl px-3 ring-1 ring-slate-200"><option value="">모든 장소</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko}</option>)}</select>
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 rounded-xl px-3 ring-1 ring-slate-200"><option value="">모든 채널</option>{["xiaohongshu", "instagram", "naver_blog", "google_search", "stay_qr", "place_qr", "direct", "other"].map((value) => <option key={value} value={value}>{channelLabel(value)}</option>)}</select>
        </div>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p> : null}
      {loading ? <p className="mt-5 text-sm font-bold text-slate-500">성과 데이터를 집계하는 중입니다.</p> : data ? <>
        {data.truncated ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">이 기간은 이벤트 20,000건까지만 집계했습니다. 분석 RPC 또는 데이터 웨어하우스 연결이 필요합니다.</p> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric icon={BarChart3} label="익명 방문자" value={data.visitors} />
          <Metric icon={Search} label="장소 상세" value={metric(data, "placeViews")} />
          <Metric icon={Navigation} label="길찾기 클릭" value={metric(data, "directions")} />
          <Metric icon={QrCode} label="QR 유입" value={metric(data, "stayQrLandings")} />
          <Metric icon={LocateFixed} label="위치 성공률" value={percent(data.metrics.locationSuccessRate)} />
          <Metric icon={MapPinCheck} label="쿠폰 사용 확인" value={metric(data, "couponRedemptions")} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Panel title="유입 채널">{data.channels.length ? data.channels.map((item) => <Row key={item.value} label={channelLabel(item.value)} value={`${item.visitors}명 · ${item.count}회`} />) : <Empty />}</Panel>
          <Panel title="인기 장소">{data.popularPlaces.length ? data.popularPlaces.slice(0, 8).map((item) => <Row key={item.placeId} label={placeNames.get(item.placeId) || item.placeId} value={`조회 ${item.views} · 길찾기 ${item.directions}`} />) : <Empty />}</Panel>
          <Panel title="자동 입력·좌표 품질"><Row label="자동 장소 검색" value={`${metric(data, "importSearches")}회`} /><Row label="자동 정보 적용" value={`${metric(data, "importApplied")}회`} /><Row label="주소 검색" value={`${metric(data, "addressSearches")}회`} /><Row label="좌표 저장 실패" value={`${metric(data, "coordinateSaveFailures")}회`} /></Panel>
        </div>
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
function defaultRange() { const to = new Date(); const from = new Date(to.getTime() - 29 * 86_400_000); return { from: dateInput(from), to: dateInput(to) }; }
function dateInput(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
