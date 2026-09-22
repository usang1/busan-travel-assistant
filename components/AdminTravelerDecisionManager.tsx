"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Link2, Plus, Save, Trash2 } from "lucide-react";
import { createEmptyTravelerDecisionBundle, emptyLocaleText } from "@/lib/traveler-decision-validation";
import type { PlaceFactTristate, PlaceWithRelations } from "@/types/database";
import { travelerThemes, type LocaleText, type PlaceFactEvidence, type TimeRange, type TravelerDecisionBundle, type TravelerDecisionSection, type TravelerMenuItem } from "@/types/traveler-decision";

const languages = ["ko", "zh", "en", "ja"] as const;
const languageNames = { ko: "한국어", zh: "중국어", en: "영어", ja: "일본어" };
const themeLabels = { first_trip: "첫 부산 여행", solo: "혼자", couple: "커플", parents: "부모님", rainy_day: "비 오는 날", food_trip: "먹방", photo_trip: "사진", cafe_trip: "카페", night_view: "야경", low_walking: "걷기 적게", luggage_day: "짐 있는 날", late_night: "늦은 밤", two_nights_three_days: "2박 3일", gwangalli_half_day: "광안리 반나절", haeundae_three_hours: "해운대 3시간" };
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus:border-teal-600 focus:outline-none";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-40";

export function AdminTravelerDecisionManager({ accessToken, places }: { accessToken: string; places: PlaceWithRelations[] }) {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [bundle, setBundle] = useState<TravelerDecisionBundle>(createEmptyTravelerDecisionBundle());
  const [busy, setBusy] = useState<TravelerDecisionSection | "load" | null>(null);
  const [message, setMessage] = useState("");
  const selectedPlace = places.find((place) => place.id === placeId);

  const api = useCallback(async (id: string, init?: RequestInit) => {
    const response = await fetch(`/api/admin/places/${id}/traveler-decision`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "여행자 의사결정 정보를 처리하지 못했습니다.");
    return body as { bundle?: TravelerDecisionBundle; ok?: boolean };
  }, [accessToken]);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setBusy("load"); setMessage("");
    try { const result = await api(id); setBundle(result.bundle ?? createEmptyTravelerDecisionBundle()); }
    catch (error) { setBundle(createEmptyTravelerDecisionBundle()); setMessage(error instanceof Error ? error.message : "불러오지 못했습니다."); }
    finally { setBusy(null); }
  }, [api]);

  useEffect(() => { void load(placeId); }, [load, placeId]);

  async function save(section: TravelerDecisionSection) {
    if (!placeId || busy) return;
    setBusy(section); setMessage("");
    try {
      await api(placeId, { method: "PUT", body: JSON.stringify({ section, value: bundle[section] }) });
      await load(placeId); setMessage(`${sectionLabels[section]} 영역을 저장했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); setBusy(null); }
  }

  function update<Section extends TravelerDecisionSection>(section: Section, value: TravelerDecisionBundle[Section]) {
    setBundle((current) => ({ ...current, [section]: value }));
  }

  const unknownFields = useMemo(() => collectUnknownFields(bundle), [bundle]);

  return (
    <section id="traveler-decision" className="space-y-5 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-950">여행자 의사결정 데이터</h2><p className="mt-1 text-sm text-slate-500">확인된 사실과 근거만 입력하며, 비어 있는 값은 미확인으로 유지합니다.</p></div>
        <label className="w-full max-w-md text-sm font-bold">편집 장소<select className={inputClass} value={placeId} onChange={(event) => setPlaceId(event.target.value)}>{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko} · {place.slug}</option>)}</select></label>
      </div>
      {message ? <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
      {!selectedPlace ? <p className="text-sm text-slate-500">먼저 장소를 등록해 주세요.</p> : busy === "load" ? <p className="text-sm text-slate-500">불러오는 중...</p> : (
        <div className="space-y-4">
          <DecisionEditor value={bundle.decision} onChange={(value) => update("decision", value)} onSave={() => void save("decision")} busy={Boolean(busy)} />
          <PracticalEditor value={bundle.practical} onChange={(value) => update("practical", value)} onSave={() => void save("practical")} busy={Boolean(busy)} />
          <OperatingEditor value={bundle.operating} onChange={(value) => update("operating", value)} onSave={() => void save("operating")} busy={Boolean(busy)} />
          <MenuEditor value={bundle.menus} onChange={(value) => update("menus", value)} onSave={() => void save("menus")} busy={Boolean(busy)} />
          <EvidenceEditor value={bundle.evidence} onChange={(value) => update("evidence", value)} onSave={() => void save("evidence")} busy={Boolean(busy)} />
          <ConnectionEditor value={bundle.connections} places={places.filter((place) => place.id !== placeId)} onChange={(value) => update("connections", value)} onSave={() => void save("connections")} busy={Boolean(busy)} />
          <PreviewAndMissing bundle={bundle} unknownFields={unknownFields} />
        </div>
      )}
    </section>
  );
}

function DecisionEditor({ value, onChange, onSave, busy }: EditorProps<"decision">) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  return <EditorSection title="방문 결정 · 실패 경고" description={`확인된 근거 ${value.evidence_count}개. 추천 점수는 근거가 있을 때만 저장됩니다.`} onSave={onSave} busy={busy}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <NumberField label="관광 적합도 (0-100)" value={value.tourist_fit_score} min={0} max={100} onChange={(tourist_fit_score) => patch({ tourist_fit_score })} />
      <NumberField label="신뢰도 (0-100)" value={value.confidence_score} min={0} max={100} onChange={(confidence_score) => patch({ confidence_score })} />
      <RatingField label="주문 난이도" value={value.order_difficulty} onChange={(order_difficulty) => patch({ order_difficulty })} />
      <RatingField label="혼자 이용 난이도" value={value.solo_difficulty} onChange={(solo_difficulty) => patch({ solo_difficulty })} />
      <RatingField label="외국인 이용 난이도" value={value.foreigner_difficulty} onChange={(foreigner_difficulty) => patch({ foreigner_difficulty })} />
      <label className="text-sm font-bold">우회 방문 가치<select className={inputClass} value={value.worth_detour_level ?? ""} onChange={(event) => patch({ worth_detour_level: (event.target.value || null) as typeof value.worth_detour_level })}><option value="">미확인</option><option value="nearby_only">근처라면</option><option value="worth_short_detour">짧은 우회 가치</option><option value="worth_long_detour">긴 우회 가치</option><option value="destination">목적지로 방문</option></select></label>
      <label className="text-sm font-bold">확인 상태<select className={inputClass} value={value.verification_status} onChange={(event) => patch({ verification_status: event.target.value as typeof value.verification_status })}>{verificationOptions}</select></label>
      <label className="text-sm font-bold">마지막 확인일<input type="datetime-local" className={inputClass} value={toLocalDateTime(value.last_verified_at)} onChange={(event) => patch({ last_verified_at: event.target.value || null })} /></label>
    </div>
    <ThemeSelector label="추천 대상" value={value.recommended_for} onChange={(recommended_for) => patch({ recommended_for })} />
    <ThemeSelector label="비추천 대상" value={value.not_recommended_for} onChange={(not_recommended_for) => patch({ not_recommended_for })} />
    <LocalizedTextEditor label="30초 방문 요약" value={value.visit_summary} onChange={(visit_summary) => patch({ visit_summary })} />
    <LocalizedTextEditor label="실패 경고" value={value.primary_warning} onChange={(primary_warning) => patch({ primary_warning })} />
  </EditorSection>;
}

function PracticalEditor({ value, onChange, onSave, busy }: EditorProps<"practical">) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  const factFields: Array<[keyof Pick<typeof value, "foreign_card" | "alipay" | "wechat_pay" | "chinese_menu" | "english_menu" | "solo_friendly" | "luggage_friendly" | "luggage_storage" | "restroom" | "reservation_required" | "wheelchair_access" | "elevator" | "stroller_friendly" | "power_outlet" | "wifi" | "queue_available">, string]> = [
    ["foreign_card", "해외카드"], ["alipay", "Alipay"], ["wechat_pay", "WeChat Pay"], ["chinese_menu", "중국어 메뉴"], ["english_menu", "영어 메뉴"], ["solo_friendly", "혼자 이용"], ["luggage_friendly", "캐리어 입장"], ["luggage_storage", "짐 보관"], ["restroom", "화장실"], ["reservation_required", "예약 필요"], ["wheelchair_access", "휠체어 접근"], ["elevator", "엘리베이터"], ["stroller_friendly", "유모차"], ["power_outlet", "콘센트"], ["wifi", "Wi-Fi"], ["queue_available", "대기 등록"],
  ];
  return <EditorSection title="중국인 입맛 · 외국인 실용정보" description="1은 낮음, 5는 높음이며 미확인은 숫자를 비워 둡니다." onSave={onSave} busy={busy}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {(["spicy_level", "oily_level", "aroma_level", "sweetness_level", "portion_level"] as const).map((key) => <RatingField key={key} label={({ spicy_level: "매운맛", oily_level: "기름짐", aroma_level: "향", sweetness_level: "단맛", portion_level: "양" })[key]} value={value[key]} onChange={(next) => patch({ [key]: next })} />)}
    </div>
    <LocalizedTextEditor label="입맛 메모" value={value.taste_notes} onChange={(taste_notes) => patch({ taste_notes })} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{factFields.map(([key, label]) => <TriStateField key={key} label={label} value={value[key]} onChange={(next) => patch({ [key]: next })} />)}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <TriStateField label="키오스크 다국어" value={value.kiosk_language_support.status} onChange={(status) => patch({ kiosk_language_support: { status, languages: status === "yes" ? value.kiosk_language_support.languages : [] } })} />
      <label className="text-sm font-bold">키오스크 언어 (쉼표 구분)<input className={inputClass} disabled={value.kiosk_language_support.status !== "yes"} value={value.kiosk_language_support.languages.join(", ")} onChange={(event) => patch({ kiosk_language_support: { ...value.kiosk_language_support, languages: commaList(event.target.value) } })} /></label>
      <label className="text-sm font-bold">흡연 정책<select className={inputClass} value={value.smoking_policy ?? ""} onChange={(event) => patch({ smoking_policy: (event.target.value || null) as typeof value.smoking_policy })}><option value="">미확인</option><option value="non_smoking">금연</option><option value="smoking_area">별도 흡연구역</option><option value="smoking_allowed">흡연 가능</option></select></label>
      <NumberField label="최소 주문 금액" value={value.minimum_order_amount} min={0} max={100000000} onChange={(minimum_order_amount) => patch({ minimum_order_amount })} />
      <NumberField label="최소 주문 인원" value={value.minimum_order_people} min={1} max={20} onChange={(minimum_order_people) => patch({ minimum_order_people })} />
      <label className="text-sm font-bold">대기 등록 방식<input className={inputClass} value={value.queue_method} onChange={(event) => patch({ queue_method: event.target.value })} /></label>
      <label className="text-sm font-bold sm:col-span-2">화장실 위치 메모<textarea className={inputClass} rows={2} value={value.restroom_location_note} onChange={(event) => patch({ restroom_location_note: event.target.value })} /></label>
    </div>
  </EditorSection>;
}

function OperatingEditor({ value, onChange, onSave, busy }: EditorProps<"operating">) {
  const patch = (next: Partial<typeof value>) => onChange({ ...value, ...next });
  return <EditorSection title="시간대 추천" description="모든 시간은 Asia/Seoul 기준입니다. 운영 종료보다 늦은 라스트오더는 저장되지 않습니다." onSave={onSave} busy={busy}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-bold">시간대<input className={inputClass} readOnly value={value.timezone} /></label><label className="text-sm font-bold">라스트오더<input type="time" className={inputClass} value={value.last_order_time ?? ""} onChange={(event) => patch({ last_order_time: event.target.value || null })} /></label><label className="text-sm font-bold">확인 상태<select className={inputClass} value={value.verification_status} onChange={(event) => patch({ verification_status: event.target.value as typeof value.verification_status })}>{verificationOptions}</select></label><label className="text-sm font-bold">마지막 확인일<input type="datetime-local" className={inputClass} value={toLocalDateTime(value.last_verified_at)} onChange={(event) => patch({ last_verified_at: event.target.value || null })} /></label></div>
    <div><h4 className="text-sm font-black">구조화 영업시간</h4><div className="mt-2 grid gap-2">{weekdayLabels.map((label, weekday) => { const row = value.structured_operating_hours.find((item) => item.weekday === weekday) ?? { weekday, open: "09:00", close: "18:00", closed: true, overnight: false }; const replace = (next: typeof row) => patch({ structured_operating_hours: [...value.structured_operating_hours.filter((item) => item.weekday !== weekday), next].sort((a, b) => a.weekday - b.weekday) }); return <div key={label} className="grid grid-cols-[3rem_1fr_1fr_auto_auto] items-center gap-2"><span className="text-sm font-bold">{label}</span><input aria-label={`${label} 시작`} type="time" disabled={row.closed} className={inputClass} value={row.open} onChange={(event) => replace({ ...row, open: event.target.value })} /><input aria-label={`${label} 종료`} type="time" disabled={row.closed} className={inputClass} value={row.close} onChange={(event) => replace({ ...row, close: event.target.value })} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={row.closed} checked={row.overnight ?? false} onChange={(event) => replace({ ...row, overnight: event.target.checked })} />익일</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={row.closed} onChange={(event) => replace({ ...row, closed: event.target.checked, overnight: false, open: event.target.checked ? "" : "09:00", close: event.target.checked ? "" : "18:00" })} />휴무</label></div>; })}</div></div>
    <TimeRangeEditor label="추천 시간대" value={value.recommended_time_ranges} onChange={(recommended_time_ranges) => patch({ recommended_time_ranges })} />
    <TimeRangeEditor label="피해야 할 시간대" value={value.avoid_time_ranges} onChange={(avoid_time_ranges) => patch({ avoid_time_ranges })} />
    <TimeRangeEditor label="사진 추천 시간대" value={value.photo_time_ranges} onChange={(photo_time_ranges) => patch({ photo_time_ranges })} />
    <ClosureEditor value={value.temporary_closures} onChange={(temporary_closures) => patch({ temporary_closures })} />
    <SeasonEditor value={value.seasonal_availability} onChange={(seasonal_availability) => patch({ seasonal_availability })} />
    <div className="grid gap-3 sm:grid-cols-2"><HourlyRecordEditor label="요일·시간별 예상 대기분" value={value.wait_time_by_weekday_hour} onChange={(wait_time_by_weekday_hour) => patch({ wait_time_by_weekday_hour })} /><HourlyRecordEditor label="요일·시간별 품절 위험 (1-5)" value={value.sellout_risk_by_hour} onChange={(sellout_risk_by_hour) => patch({ sellout_risk_by_hour })} /></div>
    <LocalizedTextEditor label="공휴일 메모" value={value.holiday_notes} onChange={(holiday_notes) => patch({ holiday_notes })} />
  </EditorSection>;
}

function MenuEditor({ value, onChange, onSave, busy }: EditorProps<"menus">) {
  function add() { const item: TravelerMenuItem = { localized_name: emptyLocaleText(), korean_original_name: "", price: null, recommendation_status: "unknown", recommendation_basis: "", spicy_level: null, oily_level: null, aroma_level: null, portion_size: null, recommended_party_size: null, contains_seafood: "unknown", contains_cilantro: "unknown", meal_type: null, ordering_note: emptyLocaleText(), menu_warning: emptyLocaleText(), availability_time: [], sold_out_risk: null, sort_order: value.length }; onChange([...value, item]); }
  const update = (index: number, item: TravelerMenuItem) => onChange(value.map((current, currentIndex) => currentIndex === index ? item : current));
  return <EditorSection title="메뉴" description="기존 메뉴와 같은 테이블을 사용합니다. 추천 여부는 unknown/yes/no로 구분하고 yes에는 근거가 필요합니다." onSave={onSave} busy={busy} action={<button type="button" className={buttonClass} onClick={add}><Plus size={16} />메뉴 추가</button>}>
    {!value.length ? <p className="text-sm text-slate-500">등록된 메뉴가 없습니다.</p> : value.map((item, index) => <div key={item.id ?? index} className="space-y-3 border-t border-slate-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-bold">한국어 원문 이름<input className={inputClass} value={item.korean_original_name} onChange={(event) => update(index, { ...item, korean_original_name: event.target.value, localized_name: { ...item.localized_name, ko: event.target.value } })} /></label><NumberField label="가격" value={item.price} min={0} max={100000000} onChange={(price) => update(index, { ...item, price })} /><TriStateField label="추천" value={item.recommendation_status} onChange={(recommendation_status) => update(index, { ...item, recommendation_status })} /><label className="text-sm font-bold">추천 근거<input className={inputClass} value={item.recommendation_basis} onChange={(event) => update(index, { ...item, recommendation_basis: event.target.value })} /></label></div>
      <LocalizedTextEditor label="메뉴명 번역" value={item.localized_name} onChange={(localized_name) => update(index, { ...item, localized_name })} compact />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{(["spicy_level", "oily_level", "aroma_level", "portion_size", "sold_out_risk"] as const).map((key) => <RatingField key={key} label={({ spicy_level: "매운맛", oily_level: "기름짐", aroma_level: "향", portion_size: "양", sold_out_risk: "품절 위험" })[key]} value={item[key]} onChange={(next) => update(index, { ...item, [key]: next })} />)}<NumberField label="권장 인원" value={item.recommended_party_size} min={1} max={20} onChange={(recommended_party_size) => update(index, { ...item, recommended_party_size })} /></div>
      <div className="grid gap-3 sm:grid-cols-3"><TriStateField label="해산물 포함" value={item.contains_seafood} onChange={(contains_seafood) => update(index, { ...item, contains_seafood })} /><TriStateField label="고수 포함" value={item.contains_cilantro} onChange={(contains_cilantro) => update(index, { ...item, contains_cilantro })} /><label className="text-sm font-bold">식사 유형<select className={inputClass} value={item.meal_type ?? ""} onChange={(event) => update(index, { ...item, meal_type: (event.target.value || null) as TravelerMenuItem["meal_type"] })}><option value="">미확인</option><option value="meal">식사</option><option value="snack">간식</option><option value="both">둘 다</option></select></label></div>
      <LocalizedTextEditor label="주문 메모" value={item.ordering_note} onChange={(ordering_note) => update(index, { ...item, ordering_note })} compact /><LocalizedTextEditor label="메뉴 경고" value={item.menu_warning} onChange={(menu_warning) => update(index, { ...item, menu_warning })} compact />
      <TimeRangeEditor label="판매 시간" value={item.availability_time} onChange={(availability_time) => update(index, { ...item, availability_time })} />
      <button type="button" className={`${buttonClass} text-rose-700`} onClick={() => onChange(value.filter((_, current) => current !== index))}><Trash2 size={16} />삭제</button>
    </div>)}
  </EditorSection>;
}

function EvidenceEditor({ value, onChange, onSave, busy }: EditorProps<"evidence">) {
  function add() { const item: PlaceFactEvidence = { field_key: "", fact_value: null, source_type: "unverified", source_label: "", source_url: "", observed_at: null, verified_at: null, verification_status: "unverified", notes: "" }; onChange([...value, item]); }
  const update = (index: number, item: PlaceFactEvidence) => onChange(value.map((current, currentIndex) => currentIndex === index ? item : current));
  return <EditorSection title="확인 상태와 필드별 출처" description="공식·점주·관리자·여행자·추론·미확인을 구분합니다. 여행자 원본 제보는 별도 비공개 테이블에 저장됩니다." onSave={onSave} busy={busy} action={<button type="button" className={buttonClass} onClick={add}><Plus size={16} />근거 추가</button>}>
    {!value.length ? <p className="text-sm text-slate-500">저장된 확인 근거가 없습니다.</p> : value.map((item, index) => <div key={item.id ?? index} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-bold">필드 키<input className={inputClass} placeholder="foreign_card" value={item.field_key} onChange={(event) => update(index, { ...item, field_key: event.target.value })} /></label>
      <label className="text-sm font-bold">출처 종류<select className={inputClass} value={item.source_type} onChange={(event) => update(index, { ...item, source_type: event.target.value as PlaceFactEvidence["source_type"] })}><option value="unverified">미확인</option><option value="official_source">공식 출처</option><option value="owner_merchant">점주</option><option value="administrator">관리자</option><option value="traveler_report">여행자 제보</option><option value="inferred">추론</option></select></label>
      <label className="text-sm font-bold">확인 상태<select className={inputClass} value={item.verification_status} onChange={(event) => update(index, { ...item, verification_status: event.target.value as PlaceFactEvidence["verification_status"] })}>{verificationOptions}</select></label>
      <label className="text-sm font-bold">관찰일<input type="datetime-local" className={inputClass} value={toLocalDateTime(item.observed_at)} onChange={(event) => update(index, { ...item, observed_at: event.target.value || null })} /></label>
      <label className="text-sm font-bold">출처 이름<input className={inputClass} value={item.source_label} onChange={(event) => update(index, { ...item, source_label: event.target.value })} /></label>
      <label className="text-sm font-bold">확인 값<input className={inputClass} value={factValueText(item.fact_value)} onChange={(event) => update(index, { ...item, fact_value: event.target.value })} /></label>
      <label className="text-sm font-bold">검증일<input type="datetime-local" className={inputClass} value={toLocalDateTime(item.verified_at)} onChange={(event) => update(index, { ...item, verified_at: event.target.value || null })} /></label>
      <label className="text-sm font-bold lg:col-span-2">출처 URL<input type="url" className={inputClass} value={item.source_url} onChange={(event) => update(index, { ...item, source_url: event.target.value })} /></label>
      <button type="button" className={`${buttonClass} self-end text-rose-700`} onClick={() => onChange(value.filter((_, current) => current !== index))}><Trash2 size={16} />삭제</button>
      <label className="text-sm font-bold sm:col-span-2 lg:col-span-4">메모<textarea className={inputClass} rows={2} value={item.notes} onChange={(event) => update(index, { ...item, notes: event.target.value })} /></label>
    </div>)}
  </EditorSection>;
}

function ConnectionEditor({ value, places, onChange, onSave, busy }: EditorProps<"connections"> & { places: PlaceWithRelations[] }) {
  function add() { if (!places[0]) return; onChange([...value, { to_place_id: places[0].id, travel_minutes: null, travel_distance: null, travel_mode: null, sequence_reason: emptyLocaleText(), valid_time_ranges: [], weather_conditions: [], trip_theme: [], active: true, priority: 0 }]); }
  const update = (index: number, item: typeof value[number]) => onChange(value.map((current, currentIndex) => currentIndex === index ? item : current));
  return <EditorSection title="장소 간 연결" description="자체 길찾기가 아니라 다음 장소 추천 근거만 저장합니다. 이동시간·거리는 확인된 값만 입력합니다." onSave={onSave} busy={busy} action={<button type="button" className={buttonClass} onClick={add}><Link2 size={16} />연결 추가</button>}>
    {!value.length ? <p className="text-sm text-slate-500">연결된 다음 장소가 없습니다.</p> : value.map((item, index) => <div key={item.id ?? index} className="space-y-3 border-t border-slate-200 pt-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm font-bold">다음 장소<select className={inputClass} value={item.to_place_id} onChange={(event) => update(index, { ...item, to_place_id: event.target.value })}>{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko}</option>)}</select></label><NumberField label="이동 시간(분)" value={item.travel_minutes} min={0} max={1440} onChange={(travel_minutes) => update(index, { ...item, travel_minutes })} /><NumberField label="이동 거리(m)" value={item.travel_distance} min={0} max={10000000} onChange={(travel_distance) => update(index, { ...item, travel_distance })} /><label className="text-sm font-bold">이동수단<select className={inputClass} value={item.travel_mode ?? ""} onChange={(event) => update(index, { ...item, travel_mode: (event.target.value || null) as typeof item.travel_mode })}><option value="">미확인</option><option value="walk">도보</option><option value="transit">대중교통</option><option value="taxi">택시</option><option value="car">자동차</option><option value="mixed">혼합</option></select></label><NumberField label="우선순위" value={item.priority} min={0} max={100} onChange={(priority) => update(index, { ...item, priority: priority ?? 0 })} /></div>
      <ThemeSelector label="여행 유형" value={item.trip_theme} onChange={(trip_theme) => update(index, { ...item, trip_theme })} /><LocalizedTextEditor label="연결 추천 이유" value={item.sequence_reason} onChange={(sequence_reason) => update(index, { ...item, sequence_reason })} compact />
      <TimeRangeEditor label="연결 유효 시간" value={item.valid_time_ranges} onChange={(valid_time_ranges) => update(index, { ...item, valid_time_ranges })} />
      <label className="block text-sm font-bold">적용 날씨 (쉼표 구분)<input className={inputClass} value={item.weather_conditions.join(", ")} onChange={(event) => update(index, { ...item, weather_conditions: commaList(event.target.value) })} /></label>
      <div className="flex gap-3"><label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={item.active} onChange={(event) => update(index, { ...item, active: event.target.checked })} />활성</label><button type="button" className={`${buttonClass} text-rose-700`} onClick={() => onChange(value.filter((_, current) => current !== index))}><Trash2 size={16} />삭제</button></div>
    </div>)}
  </EditorSection>;
}

function PreviewAndMissing({ bundle, unknownFields }: { bundle: TravelerDecisionBundle; unknownFields: string[] }) {
  return <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-black">번역 미리보기 · 미확인 필드 ({unknownFields.length})</summary><div className="mt-4 grid gap-5 lg:grid-cols-2"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">언어</th><th className="p-2">방문 요약</th><th className="p-2">실패 경고</th><th className="p-2">입맛 메모</th></tr></thead><tbody>{languages.map((locale) => <tr key={locale} className="border-t border-slate-200"><th className="p-2">{languageNames[locale]}</th><td className="p-2">{bundle.decision.visit_summary[locale] || "미입력"}</td><td className="p-2">{bundle.decision.primary_warning[locale] || "미입력"}</td><td className="p-2">{bundle.practical.taste_notes[locale] || "미입력"}</td></tr>)}</tbody></table></div><div><h4 className="flex items-center gap-2 text-sm font-black"><AlertTriangle size={16} />미확인 필드</h4>{unknownFields.length ? <ul className="mt-2 columns-1 text-sm text-slate-600 sm:columns-2">{unknownFields.map((field) => <li key={field} className="mb-1 break-inside-avoid">{field}</li>)}</ul> : <p className="mt-2 text-sm text-teal-700">현재 편집 범위에 미확인 값이 없습니다.</p>}</div></div></details>;
}

type EditorProps<Section extends TravelerDecisionSection> = { value: TravelerDecisionBundle[Section]; onChange: (value: TravelerDecisionBundle[Section]) => void; onSave: () => void; busy: boolean };
const sectionLabels: Record<TravelerDecisionSection, string> = { decision: "방문 결정", practical: "실용정보", operating: "시간대", menus: "메뉴", evidence: "출처", connections: "장소 연결" };
const verificationOptions = <><option value="unverified">미확인</option><option value="partially_verified">일부 확인</option><option value="verified">확인 완료</option><option value="stale">오래됨</option><option value="conflicting">정보 충돌</option><option value="rejected">반려</option></>;
const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function EditorSection({ title, description, onSave, busy, action, children }: { title: string; description: string; onSave: () => void; busy: boolean; action?: React.ReactNode; children: React.ReactNode }) { return <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-base font-black text-slate-950">{title}</summary><p className="mt-2 text-sm text-slate-500">{description}</p><div className="mt-4 space-y-4">{children}<div className="flex flex-wrap gap-2">{action}<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-40" disabled={busy} onClick={onSave}><Save size={16} />{busy ? "처리 중" : "이 영역 저장"}</button></div></div></details>; }
function NumberField({ label, value, min, max, onChange }: { label: string; value: number | null; min: number; max: number; onChange: (value: number | null) => void }) { return <label className="text-sm font-bold">{label}<input type="number" min={min} max={max} className={inputClass} value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></label>; }
function RatingField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { return <label className="text-sm font-bold">{label}<select className={inputClass} value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}><option value="">미확인</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select></label>; }
function TriStateField({ label, value, onChange }: { label: string; value: PlaceFactTristate; onChange: (value: PlaceFactTristate) => void }) { return <label className="text-sm font-bold">{label}<select className={inputClass} value={value} onChange={(event) => onChange(event.target.value as PlaceFactTristate)}><option value="unknown">미확인</option><option value="yes">예</option><option value="no">아니요</option></select></label>; }
function LocalizedTextEditor({ label, value, onChange, compact = false }: { label: string; value: LocaleText; onChange: (value: LocaleText) => void; compact?: boolean }) { return <div><h4 className="text-sm font-black">{label}</h4><div className="mt-2 grid gap-3 sm:grid-cols-2">{languages.map((locale) => <label key={locale} className="text-xs font-bold text-slate-600">{languageNames[locale]}<textarea rows={compact ? 2 : 3} className={inputClass} value={value[locale]} onChange={(event) => onChange({ ...value, [locale]: event.target.value })} /></label>)}</div></div>; }
function ThemeSelector({ label, value, onChange }: { label: string; value: (typeof travelerThemes)[number][]; onChange: (value: (typeof travelerThemes)[number][]) => void }) { return <fieldset><legend className="text-sm font-black">{label}</legend><div className="mt-2 flex flex-wrap gap-2">{travelerThemes.map((theme) => <label key={theme} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="checkbox" checked={value.includes(theme)} onChange={(event) => onChange(event.target.checked ? [...value, theme] : value.filter((item) => item !== theme))} />{themeLabels[theme]}</label>)}</div></fieldset>; }
function TimeRangeEditor({ label, value, onChange }: { label: string; value: TimeRange[]; onChange: (value: TimeRange[]) => void }) { return <div><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-black">{label}</h4><button type="button" className={buttonClass} onClick={() => onChange([...value, { weekdays: [1, 2, 3, 4, 5], start: "10:00", end: "12:00", note: "" }])}><Plus size={16} />추가</button></div>{value.map((range, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_8rem_3rem]"><input className={inputClass} aria-label={`${label} 요일`} value={range.weekdays.join(",")} onChange={(event) => onChange(value.map((item, current) => current === index ? { ...item, weekdays: commaList(event.target.value).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) } : item))} placeholder="요일 0-6" /><input type="time" className={inputClass} value={range.start} onChange={(event) => onChange(value.map((item, current) => current === index ? { ...item, start: event.target.value } : item))} /><input type="time" className={inputClass} value={range.end} onChange={(event) => onChange(value.map((item, current) => current === index ? { ...item, end: event.target.value } : item))} /><button type="button" aria-label={`${label} 삭제`} className={buttonClass} onClick={() => onChange(value.filter((_, current) => current !== index))}><Trash2 size={16} /></button></div>)}</div>; }
function ClosureEditor({ value, onChange }: { value: TravelerDecisionBundle["operating"]["temporary_closures"]; onChange: (value: TravelerDecisionBundle["operating"]["temporary_closures"]) => void }) { return <div><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-black">임시 휴무</h4><button type="button" className={buttonClass} onClick={() => onChange([...value, { start_date: "", end_date: "", reason: "" }])}><Plus size={16} />추가</button></div>{value.map((item, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[10rem_10rem_1fr_3rem]"><input aria-label="임시 휴무 시작일" type="date" className={inputClass} value={item.start_date} onChange={(event) => onChange(value.map((row, current) => current === index ? { ...row, start_date: event.target.value } : row))} /><input aria-label="임시 휴무 종료일" type="date" className={inputClass} value={item.end_date} onChange={(event) => onChange(value.map((row, current) => current === index ? { ...row, end_date: event.target.value } : row))} /><input aria-label="임시 휴무 사유" className={inputClass} value={item.reason} onChange={(event) => onChange(value.map((row, current) => current === index ? { ...row, reason: event.target.value } : row))} /><button type="button" aria-label="임시 휴무 삭제" className={buttonClass} onClick={() => onChange(value.filter((_, current) => current !== index))}><Trash2 size={16} /></button></div>)}</div>; }
function SeasonEditor({ value, onChange }: { value: TravelerDecisionBundle["operating"]["seasonal_availability"]; onChange: (value: TravelerDecisionBundle["operating"]["seasonal_availability"]) => void }) { return <div><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-black">계절 운영</h4><button type="button" className={buttonClass} onClick={() => onChange([...value, { start_month: 1, end_month: 12, note: "" }])}><Plus size={16} />추가</button></div>{value.map((item, index) => <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[7rem_7rem_1fr_3rem]"><input aria-label="시작 월" type="number" min={1} max={12} className={inputClass} value={item.start_month} onChange={(event) => onChange(value.map((row, current) => current === index ? { ...row, start_month: Number(event.target.value) } : row))} /><input aria-label="종료 월" type="number" min={1} max={12} className={inputClass} value={item.end_month} onChange={(event) => onChange(value.map((row, current) => current === index ? { ...row, end_month: Number(event.target.value) } : row))} /><input aria-label="계절 운영 메모" className={inputClass} value={item.note} onChange={(event) => onChange(value.map((row, current) => current === index ? { ...row, note: event.target.value } : row))} /><button type="button" aria-label="계절 운영 삭제" className={buttonClass} onClick={() => onChange(value.filter((_, current) => current !== index))}><Trash2 size={16} /></button></div>)}</div>; }
function HourlyRecordEditor({ label, value, onChange }: { label: string; value: Record<string, number | null>; onChange: (value: Record<string, number | null>) => void }) { return <label className="text-sm font-bold">{label}<textarea className={inputClass} rows={4} placeholder={"1-10=20\n6-18=5"} value={Object.entries(value).map(([key, item]) => `${key}=${item ?? ""}`).join("\n")} onChange={(event) => onChange(Object.fromEntries(event.target.value.split("\n").map((line) => line.split("=").map((item) => item.trim())).filter(([key, item]) => key && item && Number.isFinite(Number(item))).map(([key, item]) => [key, Number(item)])))} /><span className="mt-1 block text-xs font-normal text-slate-500">요일(0=일)-시간=값 형식</span></label>; }
function collectUnknownFields(bundle: TravelerDecisionBundle) { const fields: string[] = []; const visit = bundle.decision; if (visit.tourist_fit_score === null) fields.push("방문 적합도"); if (visit.worth_detour_level === null) fields.push("우회 방문 가치"); if (visit.order_difficulty === null) fields.push("주문 난이도"); if (visit.solo_difficulty === null) fields.push("혼자 이용 난이도"); if (visit.foreigner_difficulty === null) fields.push("외국인 이용 난이도"); const practicalLabels: Array<[keyof TravelerDecisionBundle["practical"], string]> = [["foreign_card", "해외카드"], ["alipay", "Alipay"], ["wechat_pay", "WeChat Pay"], ["chinese_menu", "중국어 메뉴"], ["english_menu", "영어 메뉴"], ["luggage_storage", "짐 보관"], ["restroom", "화장실"], ["wheelchair_access", "휠체어 접근"], ["elevator", "엘리베이터"], ["wifi", "Wi-Fi"], ["queue_available", "대기 등록"]]; for (const [key, label] of practicalLabels) if (bundle.practical[key] === "unknown") fields.push(label); if (!bundle.operating.structured_operating_hours.length) fields.push("구조화 영업시간"); if (!bundle.evidence.length) fields.push("필드별 근거"); return fields; }
function commaList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function toLocalDateTime(value: string | null) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return value.slice(0, 16); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function factValueText(value: unknown) { if (value === null || value === undefined) return ""; return typeof value === "string" ? value : JSON.stringify(value); }
