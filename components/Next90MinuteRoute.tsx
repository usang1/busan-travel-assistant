"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Route, ShieldCheck, Sparkles } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { useAuth } from "@/components/AuthProvider";
import { buildPracticalRoute, type PublicPlaceConnection, type RouteParty, type RoutePreferences, type RoutePurpose, type RouteWeather } from "@/lib/practical-route";
import { formatTimeAwarePrimary } from "@/lib/time-aware-place";
import { getPlaceContent, type Locale, withLocale } from "@/lib/i18n";
import { getPlaceCategoryLabel } from "@/lib/place-trust";
import { getSavedPlaceIds } from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import type { PlaceWithRelations } from "@/types/database";

type Props = {
  origin: PlaceWithRelations;
  candidates: PlaceWithRelations[];
  connections: PublicPlaceConnection[];
  locale: Locale;
};

export function Next90MinuteRoute({ origin, candidates, connections, locale }: Props) {
  const { user } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date | null>(null);
  const [preferences, setPreferences] = useState<RoutePreferences>({ currentStayMinutes: 30, weather: "dry", party: "solo", lowWalking: false, purpose: "auto" });
  const text = copy[locale];

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    if (!user) {
      setSavedIds(new Set(getSavedPlaceIds()));
      return () => window.clearInterval(timer);
    }
    const client = getSupabaseClient();
    if (!client) return () => window.clearInterval(timer);
    void client.from("place_saves").select("place_id").eq("user_id", user.id).then(({ data }) => {
      setSavedIds(new Set((data ?? []).map((row) => String(row.place_id))));
    });
    return () => window.clearInterval(timer);
  }, [user]);

  const route = useMemo(() => now ? buildPracticalRoute({ origin, candidates, connections, locale, preferences, savedPlaceIds: savedIds, now }) : null, [candidates, connections, locale, now, origin, preferences, savedIds]);
  if (!candidates.length) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><Route size={20} aria-hidden="true" /></span>
          <div><h2 className="text-xl font-black text-slate-950">{text.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{text.description}</p></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Control label={text.stay}><select value={preferences.currentStayMinutes} onChange={(event) => setPreferences({ ...preferences, currentStayMinutes: Number(event.target.value) })} className={inputClass}>{[15, 30, 45, 60].map((value) => <option key={value} value={value}>{value}{text.minutes}</option>)}</select></Control>
          <Control label={text.purpose}><select value={preferences.purpose} onChange={(event) => setPreferences({ ...preferences, purpose: event.target.value as RoutePurpose })} className={inputClass}>{Object.entries(text.purposes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Control>
          <Control label={text.weather}><select value={preferences.weather} onChange={(event) => setPreferences({ ...preferences, weather: event.target.value as RouteWeather })} className={inputClass}><option value="dry">{text.dry}</option><option value="rain">{text.rain}</option></select></Control>
          <Control label={text.party}><select value={preferences.party} onChange={(event) => setPreferences({ ...preferences, party: event.target.value as RouteParty })} className={inputClass}><option value="solo">{text.solo}</option><option value="couple">{text.couple}</option><option value="parents">{text.parents}</option></select></Control>
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={preferences.lowWalking} onChange={(event) => setPreferences({ ...preferences, lowWalking: event.target.checked })} className="size-5 accent-teal-700" />{text.lowWalking}</label>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">0</span>
          <div><p className="font-black text-slate-950">{getPlaceContent(origin, locale).name}</p><p className="text-xs text-slate-500">{text.current} · {preferences.currentStayMinutes}{text.minutes}</p></div>
        </div>
        {!now ? <p className="mt-4 text-sm text-slate-500">{text.calculating}</p> : route?.stops.length ? (
          <ol className="mt-4 space-y-4">
            {route.stops.map((stop, index) => {
              const content = getPlaceContent(stop.place, locale);
              const status = formatTimeAwarePrimary(stop.timeState, locale);
              const originPlace = index === 0 ? origin : route.stops[index - 1].place;
              return <li key={stop.place.id}>
                <div className="ml-4 border-l-2 border-dashed border-teal-200 py-3 pl-6 text-sm text-slate-600">
                  <p className="font-bold">{formatDistance(stop.distanceMeters, locale)} · {stop.travelMinutes}{text.minutes} · {travelMode(stop.travelMode, locale)}</p>
                  <p className="mt-1 break-words">{stop.reason}</p>
                  <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${stop.source === "manual" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{stop.source === "manual" ? <ShieldCheck size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}{stop.source === "manual" ? text.curated : text.rule}</span>
                </div>
                <article className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-700 text-sm font-black text-white">{index + 1}</span><div className="min-w-0 flex-1"><Link href={withLocale(`/places/${stop.place.slug}`, locale)} className="break-words font-black text-slate-950">{content.name}</Link><p className="mt-1 text-xs text-slate-500">{getPlaceCategoryLabel(stop.place.category, locale)}</p></div></div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-slate-500">{text.arrival}</span><br /><strong>{formatArrival(stop.arrivalAt, locale)}</strong></p><p><span className="text-slate-500">{text.estimatedStay}</span><br /><strong>{stop.stayMinutes}{text.minutes}</strong></p></div>
                  <p className={`mt-3 flex items-start gap-2 text-sm font-bold ${status.tone === "warning" ? "text-amber-800" : status.tone === "positive" ? "text-emerald-800" : "text-slate-600"}`}><Clock3 size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{status.text}</p>
                  {!stop.timeState.hasStructuredData ? <p className="mt-2 text-xs text-slate-500">{text.hoursUnknown}</p> : null}
                  <div className="mt-3"><DirectionsButton compact placeId={stop.place.id} name={content.name} address={content.address} coordinates={coordinates(stop.place)} origin={{ name: getPlaceContent(originPlace, locale).name, coordinates: coordinates(originPlace) }} locale={locale} /></div>
                </article>
              </li>;
            })}
          </ol>
        ) : <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">{text.empty}</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">{text.disclaimer}</p>
      </div>
    </section>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-bold text-slate-600">{label}{children}</label>; }
function coordinates(place: PlaceWithRelations) { return typeof place.latitude === "number" && typeof place.longitude === "number" ? { latitude: place.latitude, longitude: place.longitude } : null; }
function formatArrival(date: Date, locale: Locale) { return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(date); }
function formatDistance(value: number | null, locale: Locale) { if (value === null) return copy[locale].distanceUnknown; return value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`; }
function travelMode(value: PublicPlaceConnection["travel_mode"], locale: Locale) { return modes[locale][value ?? "walk"]; }
const inputClass = "mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900";
const modes = {
  ko: { walk: "도보", transit: "대중교통", taxi: "택시", car: "자동차", mixed: "혼합" }, zh: { walk: "步行", transit: "公共交通", taxi: "出租车", car: "汽车", mixed: "多种方式" },
  en: { walk: "Walk", transit: "Transit", taxi: "Taxi", car: "Car", mixed: "Mixed" }, ja: { walk: "徒歩", transit: "公共交通", taxi: "タクシー", car: "車", mixed: "複合" },
} as const;
const copy = {
  ko: { title: "다음 90분", description: "현재 시각과 선택한 조건으로 다음 동선을 계산합니다.", stay: "이곳에 더 머무를 시간", purpose: "다음 목적", weather: "날씨 조건", party: "여행 인원", dry: "비 아님", rain: "비 오는 날", solo: "혼자", couple: "커플", parents: "부모님 동반", lowWalking: "걷는 거리 줄이기", current: "현재 장소", minutes: "분", calculating: "현재 시각을 확인하는 중입니다.", curated: "관리자 연결", rule: "규칙 기반 후보", arrival: "권장 도착", estimatedStay: "예상 체류", hoursUnknown: "영업시간은 아직 확인되지 않았습니다.", empty: "이 조건과 90분 안에서 방문 가능한 공개·검수 장소를 찾지 못했습니다.", disclaimer: "자동 후보의 체류시간은 일정 계산용 추정치입니다. 검수된 연결과 영업정보만 확정 정보로 표시합니다.", distanceUnknown: "거리 미확인", purposes: { auto: "자동", food: "식사", cafe: "카페", photo: "사진·관광", night: "야경" } },
  zh: { title: "接下来90分钟", description: "根据当前时间和所选条件计算下一段行程。", stay: "还要在这里停留", purpose: "下一目的", weather: "天气条件", party: "同行人员", dry: "无雨", rain: "雨天", solo: "独自", couple: "情侣", parents: "带父母", lowWalking: "减少步行", current: "当前地点", minutes: "分钟", calculating: "正在确认当前时间。", curated: "管理员已连接", rule: "规则候选", arrival: "建议到达", estimatedStay: "预计停留", hoursUnknown: "营业时间尚未确认。", empty: "在所选条件和90分钟内，没有可推荐的公开审核地点。", disclaimer: "自动候选的停留时间仅用于行程估算；只有已审核的连接和营业信息会作为确认信息显示。", distanceUnknown: "距离未确认", purposes: { auto: "自动", food: "用餐", cafe: "咖啡", photo: "拍照·观光", night: "夜景" } },
  en: { title: "Your next 90 minutes", description: "Build the next leg using the current time and your selected conditions.", stay: "More time here", purpose: "Next purpose", weather: "Weather", party: "Group", dry: "No rain", rain: "Rainy", solo: "Solo", couple: "Couple", parents: "With parents", lowWalking: "Reduce walking", current: "Current place", minutes: " min", calculating: "Checking the current time.", curated: "Admin-curated link", rule: "Rule-based option", arrival: "Suggested arrival", estimatedStay: "Estimated stay", hoursUnknown: "Opening hours are not yet verified.", empty: "No public reviewed place fits these conditions within 90 minutes.", disclaimer: "Stay times for automatic options are planning estimates. Only reviewed links and hours are presented as verified facts.", distanceUnknown: "Distance unverified", purposes: { auto: "Automatic", food: "Meal", cafe: "Cafe", photo: "Photo·sight", night: "Night view" } },
  ja: { title: "次の90分", description: "現在時刻と選択条件から次の動線を組み立てます。", stay: "ここでの残り滞在時間", purpose: "次の目的", weather: "天気条件", party: "同行者", dry: "雨なし", rain: "雨の日", solo: "一人", couple: "カップル", parents: "親同伴", lowWalking: "歩く距離を減らす", current: "現在地", minutes: "分", calculating: "現在時刻を確認中です。", curated: "管理者設定の接続", rule: "ルール候補", arrival: "推奨到着", estimatedStay: "滞在目安", hoursUnknown: "営業時間は未確認です。", empty: "この条件と90分以内で訪問できる公開・審査済みスポットがありません。", disclaimer: "自動候補の滞在時間は計画用の目安です。確認済みの接続と営業時間のみ確定情報として表示します。", distanceUnknown: "距離未確認", purposes: { auto: "自動", food: "食事", cafe: "カフェ", photo: "写真・観光", night: "夜景" } },
};
