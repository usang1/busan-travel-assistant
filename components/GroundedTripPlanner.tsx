"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Bot, CalendarPlus, Clock3, LocateFixed, MapPinned, RefreshCw, Route, Save, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { TravelMap } from "@/components/TravelMap";
import { useAuth } from "@/components/AuthProvider";
import { type Locale, withLocale } from "@/lib/i18n";
import { cityRegions, placeCities, placeCityLabels, type PlaceCity } from "@/lib/city-regions";
import { getPreferredMapProvider, type MapMarker } from "@/lib/map-provider";
import type { TripPlaceWithPlace, TripRecord } from "@/types/database";
import type { GroundedTripPlan } from "@/types/grounded-trip";

type ApplyTarget = "new" | "replace";
type Props = {
  locale: Locale;
  activeTrip: TripRecord | null;
  tripPlaces: TripPlaceWithPlace[];
  savedPlaceIds: string[];
  disabled: boolean;
  onApplyPlan: (plan: GroundedTripPlan, target: ApplyTarget) => Promise<void>;
};

export function GroundedTripPlanner({ locale, activeTrip, tripPlaces, savedPlaceIds, disabled, onApplyPlan }: Props) {
  const { session } = useAuth();
  const text = copy[locale];
  const [requestText, setRequestText] = useState("");
  const [duration, setDuration] = useState(180);
  const [city, setCity] = useState<PlaceCity>("busan");
  const [district, setDistrict] = useState("haeundae-gu");
  const [food, setFood] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [travelType, setTravelType] = useState("solo");
  const [budget, setBudget] = useState("");
  const [walking, setWalking] = useState("low");
  const [weather, setWeather] = useState("dry");
  const [luggage, setLuggage] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<GroundedTripPlan | null>(null);
  const [aiStatus, setAiStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const districtOptions = cityRegions(city);
  const selectedDistrict = districtOptions.find((item) => item.key === district) ?? districtOptions[0];

  async function submit(mode: "plan" | "recover") {
    if (loading) return;
    setLoading(true);
    setError("");
    const start = mode === "recover" && activeTrip
      ? recoveryStart(activeTrip, tripPlaces)
      : new Date();
    try {
      const response = await fetch("/api/grounded-trip-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          mode,
          request_text: requestText,
          conditions: {
            current_location: { label: selectedDistrict.labels[locale], city_code: city, district_code: district, ...currentCoordinates },
            available_minutes: duration,
            party_size: partySize,
            travel_type: travelType,
            budget: budget ? Number(budget) : null,
            desired_food: food.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
            excluded_food: [],
            walking_preference: walking,
            weather,
            start_time: start.toISOString(),
            end_time: new Date(start.getTime() + duration * 60_000).toISOString(),
            must_visit_places: [],
            saved_places: savedPlaceIds,
            language: locale,
            accessibility_requirements: travelType === "parents" ? ["step_free"] : [],
            luggage,
            desired_finish_location: null,
          },
          existing_itinerary: mode === "recover" ? tripPlaces.map((item) => ({ place_id: item.place_id, planned_time: item.planned_time?.slice(0, 5) ?? null, stay_minutes: item.stay_minutes ?? null })) : [],
        }),
      });
      const result = await response.json() as { plan?: GroundedTripPlan; ai_status?: string; message?: string };
      if (!response.ok || !result.plan) throw new Error(result.message || "planning_failed");
      setPlan(result.plan);
      setAiStatus(result.ai_status ?? "disabled");
      setSelectedId(result.plan.places[0]?.id ?? null);
    } catch (caught) {
      setError(errorMessage(caught instanceof Error ? caught.message : "planning_failed", locale));
    } finally {
      setLoading(false);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus(text.locationUnavailable); return; }
    setLocationStatus(text.locating);
    navigator.geolocation.getCurrentPosition((position) => {
      setCurrentCoordinates({ latitude: roundCoordinate(position.coords.latitude), longitude: roundCoordinate(position.coords.longitude) });
      setLocationStatus(text.locationApplied);
    }, () => setLocationStatus(text.locationDenied), { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  }

  async function apply(target: ApplyTarget) {
    if (!plan?.places.length || applying) return;
    if (target === "replace" && !window.confirm(text.replaceConfirm)) return;
    setApplying(true);
    try { await onApplyPlan(plan, target); } finally { setApplying(false); }
  }

  return (
    <section className="overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-[24px]">
      <div className="border-b border-slate-200 bg-teal-50 px-5 py-5">
        <p className="flex items-center gap-2 text-xs font-black uppercase text-teal-800"><Sparkles size={16} aria-hidden="true" />{text.eyebrow}</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">{text.title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{text.description}</p>
      </div>

      <div className="space-y-5 p-5">
        <label className="block text-sm font-black text-slate-800">
          {text.requestLabel}
          <textarea value={requestText} onChange={(event) => setRequestText(event.target.value)} maxLength={800} rows={3} placeholder={text.requestPlaceholder} className="mt-2 w-full resize-y rounded-lg bg-slate-50 px-3 py-3 text-base font-medium leading-6 text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-teal-400" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={{ ko: "도시", zh: "城市", en: "City", ja: "都市" }[locale]}><select value={city} onChange={(event) => { const next = event.target.value as PlaceCity; setCity(next); setDistrict(cityRegions(next)[0].key); setCurrentCoordinates(null); }} className={inputClass}>{placeCities.map((item) => <option key={item.key} value={item.key}>{placeCityLabels[item.key][locale]}</option>)}</select></Field>
          <Field label={text.duration}><select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={inputClass}><option value={180}>{text.threeHours}</option><option value={240}>{text.halfDay}</option><option value={480}>{text.fullDay}</option></select></Field>
          <Field label={text.area}><select value={district} onChange={(event) => { setDistrict(event.target.value); setCurrentCoordinates(null); }} className={inputClass}>{districtOptions.map((item) => <option key={item.key} value={item.key}>{item.labels[locale]}</option>)}</select></Field>
          <Field label={text.party}><select value={travelType} onChange={(event) => setTravelType(event.target.value)} className={inputClass}><option value="solo">{text.solo}</option><option value="couple">{text.couple}</option><option value="parents">{text.parents}</option><option value="friends">{text.friends}</option></select></Field>
          <Field label={text.people}><input type="number" min={1} max={12} value={partySize} onChange={(event) => setPartySize(Math.max(1, Math.min(12, Number(event.target.value))))} className={inputClass} /></Field>
          <Field label={text.food}><input value={food} onChange={(event) => setFood(event.target.value)} maxLength={80} placeholder={text.foodPlaceholder} className={inputClass} /></Field>
          <Field label={text.budget}><input type="number" min={0} step={1000} value={budget} onChange={(event) => setBudget(event.target.value)} placeholder={text.budgetPlaceholder} className={inputClass} /></Field>
          <Field label={text.walking}><select value={walking} onChange={(event) => setWalking(event.target.value)} className={inputClass}><option value="low">{text.walkLow}</option><option value="normal">{text.walkNormal}</option><option value="high">{text.walkHigh}</option></select></Field>
          <Field label={text.weather}><select value={weather} onChange={(event) => setWeather(event.target.value)} className={inputClass}><option value="dry">{text.dry}</option><option value="rain">{text.rain}</option><option value="snow">{text.snow}</option></select></Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={requestLocation} className={secondaryButton}><LocateFixed size={17} aria-hidden="true" />{text.useLocation}</button>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-black text-slate-700 ring-1 ring-slate-200"><input type="checkbox" checked={luggage} onChange={(event) => setLuggage(event.target.checked)} className="size-5 accent-teal-700" />{text.luggage}</label>
          {locationStatus ? <span role="status" className="text-xs font-semibold text-slate-600">{locationStatus}</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || loading} onClick={() => void submit("plan")} className={primaryButton}><WandSparkles size={18} aria-hidden="true" />{loading ? text.planning : text.makePlan}</button>
          {activeTrip && tripPlaces.length ? <button type="button" disabled={disabled || loading} onClick={() => void submit("recover")} className={secondaryButton}><RefreshCw size={17} aria-hidden="true" />{text.checkTrip}</button> : null}
        </div>
        {error ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800 ring-1 ring-rose-100">{error}</p> : null}
      </div>

      {plan ? <PlanResult locale={locale} plan={plan} aiStatus={aiStatus} selectedId={selectedId} onSelect={setSelectedId} activeTrip={activeTrip} applying={applying} onApply={apply} /> : null}
    </section>
  );
}

function PlanResult({ locale, plan, aiStatus, selectedId, onSelect, activeTrip, applying, onApply }: { locale: Locale; plan: GroundedTripPlan; aiStatus: string; selectedId: string | null; onSelect: (id: string) => void; activeTrip: TripRecord | null; applying: boolean; onApply: (target: ApplyTarget) => Promise<void> }) {
  const text = copy[locale];
  const markers = useMemo<MapMarker[]>(() => plan.places.map((place, index) => ({ id: place.id, title: place.name, subtitle: place.address, category: place.category, position: { latitude: place.latitude, longitude: place.longitude }, href: withLocale(`/places/${place.slug}`, locale), imageUrl: place.thumbnail_url, meta: place.open_status, sequence: index + 1 })), [locale, plan.places]);
  const center = markers.length ? { latitude: markers.reduce((sum, marker) => sum + marker.position.latitude, 0) / markers.length, longitude: markers.reduce((sum, marker) => sum + marker.position.longitude, 0) / markers.length } : null;

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black text-teal-700">{aiStatus === "completed" ? text.aiOrdered : text.rulePlan}</p><h3 className="mt-1 text-xl font-black text-slate-950">{plan.route_title}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{plan.total_duration}{text.minutes} · {text.walking} {plan.total_walking_time}{text.minutes} · {formatCost(plan.total_cost_range, locale)}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={applying || !plan.places.length} onClick={() => void onApply("new")} className={primaryButton}><CalendarPlus size={17} />{text.saveNew}</button>{activeTrip ? <button type="button" disabled={applying || !plan.places.length} onClick={() => void onApply("replace")} className={secondaryButton}><Save size={17} />{text.applyCurrent}</button> : null}</div>
      </div>

      {plan.recovery.checked ? <div className={`mt-4 rounded-lg px-4 py-3 text-sm ring-1 ${plan.recovery.issues.length ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-emerald-50 text-emerald-900 ring-emerald-200"}`}><p className="font-black">{plan.recovery.issues.length ? text.recoveryIssues.replace("{count}", String(plan.recovery.issues.length)) : text.noRecoveryIssue}</p>{plan.recovery.changes.map((change) => <p key={change.from_place_id} className="mt-1 text-xs font-semibold">{change.from_place_id.slice(0, 8)} → {change.to_place_id?.slice(0, 8) ?? text.noAlternative} · {change.reason_codes.join(", ")}</p>)}<p className="mt-2 text-xs">{text.noAutoApply}</p></div> : null}
      {center ? <div className="mt-4 h-[320px] overflow-hidden rounded-lg"><TravelMap center={center} markers={markers} provider={getPreferredMapProvider()} locale={locale} selectedId={selectedId} onSelectMarker={onSelect} className="h-full" /></div> : <p className="mt-4 rounded-lg bg-white p-5 text-center text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{text.noCandidates}</p>}

      <div className="mt-4 space-y-3">
        {plan.places.map((place, index) => {
          const previous = plan.places[index - 1];
          return <article key={place.id} className={`bg-white p-4 ring-1 ${selectedId === place.id ? "ring-2 ring-teal-400" : "ring-slate-200"}`}>
            <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-700 text-sm font-black text-white">{index + 1}</span><div className="min-w-0 flex-1"><Link href={withLocale(`/places/${place.slug}`, locale)} className="text-base font-black text-slate-950 underline-offset-4 hover:underline">{place.name}</Link>{place.korean_name !== place.name ? <p className="mt-0.5 text-xs text-slate-500">{place.korean_name}</p> : null}<p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-600"><span><Clock3 size={13} className="mr-1 inline" />{formatTime(place.arrival_time, locale)} · {place.stay_minutes}{text.minutes}</span><span>{place.travel_mode} · {place.travel_minutes}{text.minutes}</span></p></div>{place.thumbnail_url ? <Image src={place.thumbnail_url} alt="" width={72} height={72} className="size-[72px] shrink-0 object-cover" /> : null}</div>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-800">{place.recommendation_reason}</p>
            <p className={`mt-2 text-xs font-black ${["closed_today", "temporary_closed", "after_last_order", "closes_before_arrival"].includes(place.open_status_code) ? "text-rose-700" : "text-emerald-700"}`}>{place.open_status}</p>
            {place.warnings.length ? <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-950">{place.warnings.map((warning) => <p key={warning} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{warning}</p>)}</div> : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-500">{text.verified}: {place.verification_status} · {place.last_verified_at ? place.last_verified_at.slice(0, 10) : text.unverified}</p><DirectionsButton compact placeId={place.id} name={place.korean_name} address={place.address} coordinates={{ latitude: place.latitude, longitude: place.longitude }} origin={previous ? { name: previous.korean_name, coordinates: { latitude: previous.latitude, longitude: previous.longitude } } : undefined} locale={locale} /></div>
            {place.menu_guidance ? <details className="mt-3 rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-black text-slate-800">{text.menuGuide}</summary><p className="mt-2 text-sm font-black text-slate-950">{place.menu_guidance.korean_order_text}</p><p className="mt-1 text-xs text-slate-600">{place.menu_guidance.items.map((item) => `${item.localized_name} × ${item.quantity}`).join(" · ")}</p></details> : null}
            {place.alternative_places.length ? <p className="mt-3 text-xs font-semibold text-slate-600">{text.alternatives}: {place.alternative_places.map((item, itemIndex) => <span key={item.id}>{itemIndex ? " · " : ""}<Link href={withLocale(`/places/${item.slug}`, locale)} className="font-black text-teal-700 underline underline-offset-2">{item.name}</Link></span>)}</p> : null}
            {place.unresolved_conditions.length ? <p className="mt-2 text-xs text-slate-500">{text.unresolved}: {place.unresolved_conditions.join(", ")}</p> : null}
          </article>;
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-black text-slate-600">{label}{children}</label>; }
function roundCoordinate(value: number) { return Math.round(value * 10_000) / 10_000; }
function formatTime(value: string, locale: Locale) { return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : locale === "ko" ? "ko-KR" : "en-US", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)); }
function formatCost(value: GroundedTripPlan["total_cost_range"], locale: Locale) { if (!value) return copy[locale].costUnknown; const amount = value.min === value.max ? `₩${value.min.toLocaleString("ko-KR")}` : `₩${value.min.toLocaleString("ko-KR")}-₩${value.max.toLocaleString("ko-KR")}`; return value.complete ? amount : `${amount} (${copy[locale].partial})`; }
function recoveryStart(trip: TripRecord, items: TripPlaceWithPlace[]) { const time = items.find((item) => item.planned_time)?.planned_time?.slice(0, 5) ?? "09:00"; return new Date(`${trip.start_date}T${time}:00+09:00`); }
function errorMessage(code: string, locale: Locale) { const key = code === "rate_limited" ? "rateLimited" : code === "places_unavailable" ? "placesUnavailable" : code === "invalid_input" ? "invalidInput" : "failed"; return copy[locale][key]; }

const inputClass = "mt-1.5 h-11 w-full rounded-lg bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-teal-400";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-300 transition active:scale-95 disabled:opacity-50";

const copy = {
  ko: { eyebrow: "실제 장소로 만드는 여행 도구", title: "조건부터 정하고, 실행 가능한 코스를 받으세요", description: "선택한 도시의 공개·검수 장소만 사용하고 도착 시각의 영업 여부와 이동 부담을 서버에서 다시 계산합니다. AI가 없어도 규칙 기반으로 동작합니다.", requestLabel: "자연어 요청 (선택)", requestPlaceholder: "지금 해운대인데 3시간 남았고 돼지고기를 먹고 싶고 많이 걷기는 싫어.", duration: "남은 시간", threeHours: "3시간", halfDay: "반나절 (4시간)", fullDay: "하루 (8시간)", area: "현재 지역", party: "동행", people: "인원", food: "먹고 싶은 것", foodPlaceholder: "돼지고기, 카페", budget: "총 예산 (원)", budgetPlaceholder: "예: 80000", walking: "걷기", walkLow: "적게", walkNormal: "보통", walkHigh: "많아도 괜찮음", weather: "날씨", dry: "맑음", rain: "비", snow: "눈", solo: "혼자", couple: "커플", parents: "부모님", friends: "친구", useLocation: "현재 위치 사용", luggage: "캐리어 있음", locating: "위치를 확인하는 중입니다.", locationApplied: "정확한 좌표 대신 반올림한 현재 위치를 이번 요청에만 사용합니다.", locationDenied: "위치 권한 없이 선택 지역 기준으로 계산합니다.", locationUnavailable: "이 브라우저에서는 위치를 사용할 수 없습니다.", makePlan: "실행 코스 만들기", planning: "계산 중", checkTrip: "현재 일정 문제 확인", aiOrdered: "검증 후보를 AI가 순서화 · 사실은 서버 재계산", rulePlan: "서버 규칙 기반 코스", minutes: "분", saveNew: "새 일정으로 저장", applyCurrent: "현재 일정에 적용", replaceConfirm: "현재 일정의 장소 순서를 이 코스로 교체할까요? 기존 일정은 확인 후에만 변경됩니다.", recoveryIssues: "현재 일정에서 {count}개 문제를 찾았습니다.", noRecoveryIssue: "등록된 정보 기준으로 현재 일정 충돌이 없습니다.", noAlternative: "대안 없음", noAutoApply: "변경안은 자동 적용되지 않습니다. 비교한 뒤 적용 버튼을 누르세요.", noCandidates: "조건을 모두 만족하는 검수 장소가 없습니다. 지역·시간·걷기 조건을 넓혀 보세요.", verified: "확인 상태", unverified: "확인일 미등록", menuGuide: "확인된 메뉴로 주문 문장 보기", alternatives: "대체 후보", unresolved: "확인되지 않은 조건", costUnknown: "비용 미확인", partial: "일부 비용만 확인", rateLimited: "요청이 많습니다. 잠시 후 다시 시도해 주세요.", placesUnavailable: "장소 데이터를 불러오지 못했습니다.", invalidInput: "입력 조건을 확인해 주세요.", failed: "코스를 만들지 못했습니다. 일반 장소 검색과 기존 일정은 그대로 사용할 수 있습니다." },
  zh: { eyebrow: "连接真实地点的旅行工具", title: "先选条件，再生成可执行路线", description: "只使用所选城市公开且已审核的地点，并由服务器重新计算到达时的营业状态与移动负担。没有 AI 也能按规则运行。", requestLabel: "自然语言需求（可选）", requestPlaceholder: "我现在在海云台，还剩3小时，晚饭想吃猪肉，不想走太多路。", duration: "剩余时间", threeHours: "3小时", halfDay: "半天（4小时）", fullDay: "一天（8小时）", area: "当前区域", party: "同行", people: "人数", food: "想吃什么", foodPlaceholder: "猪肉、咖啡", budget: "总预算（韩元）", budgetPlaceholder: "例：80000", walking: "步行", walkLow: "少走", walkNormal: "一般", walkHigh: "可以多走", weather: "天气", dry: "晴", rain: "雨", snow: "雪", solo: "独自", couple: "情侣", parents: "父母", friends: "朋友", useLocation: "使用当前位置", luggage: "带大行李箱", locating: "正在确认位置。", locationApplied: "本次请求仅使用四舍五入后的坐标，不发送精确位置。", locationDenied: "未使用位置权限，将按所选区域计算。", locationUnavailable: "此浏览器无法使用位置。", makePlan: "生成可执行路线", planning: "计算中", checkTrip: "检查当前行程", aiOrdered: "AI 仅排序审核候选，事实由服务器重算", rulePlan: "服务器规则路线", minutes: "分钟", saveNew: "保存为新行程", applyCurrent: "应用到当前行程", replaceConfirm: "要用这条路线替换当前行程地点吗？只有确认后才会更改。", recoveryIssues: "当前行程发现 {count} 个问题。", noRecoveryIssue: "按已登记信息，当前行程没有冲突。", noAlternative: "无替代", noAutoApply: "不会自动应用更改。请比较后再点击应用。", noCandidates: "没有满足全部条件的审核地点，请放宽区域、时间或步行条件。", verified: "确认状态", unverified: "未登记确认日期", menuGuide: "查看基于已确认菜单的韩语点餐句", alternatives: "替代地点", unresolved: "尚未确认", costUnknown: "费用未确认", partial: "仅部分费用已确认", rateLimited: "请求过多，请稍后再试。", placesUnavailable: "无法加载地点数据。", invalidInput: "请检查输入条件。", failed: "无法生成路线。普通地点搜索和原有行程仍可使用。" },
  en: { eyebrow: "Trip tool grounded in real places", title: "Set the constraints, then get an executable route", description: "Only reviewed public places in the selected city are used. Arrival-time opening status and travel effort are recalculated on the server. Rule-based planning works without AI.", requestLabel: "Natural-language request (optional)", requestPlaceholder: "I am in Haeundae with 3 hours, want pork for dinner, and prefer less walking.", duration: "Time available", threeHours: "3 hours", halfDay: "Half day (4 hours)", fullDay: "Full day (8 hours)", area: "Current area", party: "Group", people: "People", food: "Food", foodPlaceholder: "pork, cafe", budget: "Total budget (KRW)", budgetPlaceholder: "e.g. 80000", walking: "Walking", walkLow: "Less", walkNormal: "Normal", walkHigh: "More is fine", weather: "Weather", dry: "Dry", rain: "Rain", snow: "Snow", solo: "Solo", couple: "Couple", parents: "Parents", friends: "Friends", useLocation: "Use current location", luggage: "Carrying luggage", locating: "Checking location.", locationApplied: "Only rounded coordinates are used for this request.", locationDenied: "Planning from the selected area without location access.", locationUnavailable: "Location is unavailable in this browser.", makePlan: "Build executable route", planning: "Calculating", checkTrip: "Check current trip", aiOrdered: "AI ordered verified candidates · server recomputed facts", rulePlan: "Server rule-based route", minutes: " min", saveNew: "Save as new trip", applyCurrent: "Apply to current trip", replaceConfirm: "Replace the current trip places with this route? Nothing changes until you confirm.", recoveryIssues: "Found {count} issue(s) in the current trip.", noRecoveryIssue: "No conflict with registered data was found.", noAlternative: "No alternative", noAutoApply: "Changes are never applied automatically. Compare first, then apply.", noCandidates: "No reviewed place meets every condition. Broaden the area, time, or walking limit.", verified: "Verification", unverified: "No verification date", menuGuide: "View Korean order phrase from verified menus", alternatives: "Alternatives", unresolved: "Unresolved", costUnknown: "Cost unverified", partial: "partial cost only", rateLimited: "Too many requests. Try again shortly.", placesUnavailable: "Place data is unavailable.", invalidInput: "Check the input conditions.", failed: "A route could not be built. Regular search and existing trips still work." },
  ja: { eyebrow: "実在する場所につながる旅行ツール", title: "条件を決めて、実行できるコースを作成", description: "選択した都市の公開・確認済みスポットだけを使い、到着時の営業状況と移動負担をサーバーで再計算します。AIがなくてもルールで動作します。", requestLabel: "自然文の希望（任意）", requestPlaceholder: "今は海雲台で、あと3時間。夕食は豚肉、歩く距離は少なめがいい。", duration: "残り時間", threeHours: "3時間", halfDay: "半日（4時間）", fullDay: "1日（8時間）", area: "現在エリア", party: "同行", people: "人数", food: "食べたいもの", foodPlaceholder: "豚肉、カフェ", budget: "総予算（ウォン）", budgetPlaceholder: "例：80000", walking: "徒歩", walkLow: "少なめ", walkNormal: "普通", walkHigh: "多くても可", weather: "天気", dry: "晴れ", rain: "雨", snow: "雪", solo: "一人", couple: "カップル", parents: "両親", friends: "友人", useLocation: "現在地を使う", luggage: "スーツケースあり", locating: "位置を確認中です。", locationApplied: "正確な位置ではなく丸めた座標を今回だけ使用します。", locationDenied: "位置情報なしで選択エリアを基準に計算します。", locationUnavailable: "このブラウザでは位置情報を使えません。", makePlan: "実行コース作成", planning: "計算中", checkTrip: "現在の日程を確認", aiOrdered: "確認済み候補をAIが並べ替え・事実はサーバーで再計算", rulePlan: "サーバールールのコース", minutes: "分", saveNew: "新しい日程に保存", applyCurrent: "現在の日程に適用", replaceConfirm: "現在の日程をこのコースに置き換えますか？確認するまで変更されません。", recoveryIssues: "現在の日程で{count}件の問題を検出しました。", noRecoveryIssue: "登録情報との時間競合はありません。", noAlternative: "代替なし", noAutoApply: "変更は自動適用されません。比較後に適用してください。", noCandidates: "全条件を満たす確認済み場所がありません。エリア・時間・徒歩条件を広げてください。", verified: "確認状態", unverified: "確認日未登録", menuGuide: "確認済みメニューの韓国語注文文", alternatives: "代替候補", unresolved: "未確認条件", costUnknown: "費用未確認", partial: "一部費用のみ確認", rateLimited: "リクエストが多すぎます。しばらくしてからお試しください。", placesUnavailable: "場所データを読み込めません。", invalidInput: "入力条件を確認してください。", failed: "コースを作成できませんでした。通常検索と既存日程は引き続き使えます。" },
} satisfies Record<Locale, Record<string, string>>;
