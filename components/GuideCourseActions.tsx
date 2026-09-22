"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Heart, ListChecks } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createGuestTrip, saveGuestTripLayout } from "@/lib/guest-trips";
import { getPlaceContent, type Locale, withLocale } from "@/lib/i18n";
import { readSavedItems, writeSavedItems, type SavedItem } from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import type { PlaceWithRelations } from "@/types/database";
import type { Guide, GuideStop } from "@/types/guide";

type CourseStop = GuideStop & { place: PlaceWithRelations };
type Props = { guide: Guide; stops: CourseStop[]; locale: Locale };

export function GuideCourseActions({ guide, stops, locale }: Props) {
  const { user } = useAuth();
  const text = copy[locale];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(stops.map((stop) => stop.place_id)));
  const [startDate, setStartDate] = useState(todayInSeoul());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedStops = useMemo(() => stops.filter((stop) => selected.has(stop.place_id)), [selected, stops]);

  async function saveCourse() {
    if (busy || !selectedStops.length) return;
    setBusy(true); setMessage("");
    try {
      if (user) {
        const client = getSupabaseClient();
        if (!client) throw new Error(text.failed);
        const [guideResult, placesResult] = await Promise.all([
          client.from("guide_saves").upsert({ user_id: user.id, guide_id: guide.id }, { onConflict: "user_id,guide_id", ignoreDuplicates: true }),
          client.from("place_saves").upsert(selectedStops.map((stop) => ({ user_id: user.id, place_id: stop.place_id })), { onConflict: "user_id,place_id", ignoreDuplicates: true }),
        ]);
        if (guideResult.error || placesResult.error) throw guideResult.error ?? placesResult.error;
      } else {
        const guideItem: SavedItem = { id: guide.id, type: "guide", titleKo: guide.title_ko, titleZh: guide.title_zh, href: withLocale(`/guides/${guide.slug}`, locale), imageUrl: guide.cover_image, meta: guide.area, savedAt: new Date().toISOString() };
        const placeItems: SavedItem[] = selectedStops.map((stop) => ({ id: stop.place.id, type: "place", titleKo: stop.place.name_ko, titleZh: stop.place.name_zh, href: withLocale(`/places/${stop.place.slug}`, locale), imageUrl: stop.place.thumbnail_url, meta: guide.area, savedAt: new Date().toISOString() }));
        writeSavedItems([guideItem, ...placeItems, ...readSavedItems()]);
      }
      window.dispatchEvent(new Event("guide-save-change"));
      window.dispatchEvent(new Event("place-save-change"));
      setMessage(text.saved);
    } catch { setMessage(text.failed); }
    finally { setBusy(false); }
  }

  async function addToTrip() {
    if (busy || !selectedStops.length || !startDate) return;
    setBusy(true); setMessage("");
    try {
      let tripId = "";
      if (user) {
        const client = getSupabaseClient();
        if (!client) throw new Error(text.failed);
        const { data, error } = await client.rpc("copy_published_guide_to_trip", {
          source_guide_id: guide.id,
          requested_start_date: startDate,
          selected_place_ids: selectedStops.map((stop) => stop.place_id),
          requested_title: guide[`title_${locale}`],
        });
        if (error || typeof data !== "string") throw error ?? new Error(text.failed);
        tripId = data;
      } else {
        const trip = createGuestTrip({ title: guide[`title_${locale}`], startDate, endDate: startDate, visibility: "private", sourceGuideId: guide.id, sourceGuideUpdatedAt: guide.updated_at });
        const layout = buildSnapshotLayout(selectedStops, guide.recommended_start_time);
        saveGuestTripLayout(trip.id, layout);
        tripId = trip.id;
      }
      setMessage(text.added);
      window.setTimeout(() => { window.location.href = `${withLocale("/itinerary", locale)}?trip=${encodeURIComponent(tripId)}`; }, 350);
    } catch { setMessage(text.failedMigration); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3"><ListChecks size={22} className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" /><div><h2 className="text-lg font-black text-slate-950">{text.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{text.description}</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setSelected(new Set(stops.map((stop) => stop.place_id)))} className={secondaryClass}>{text.all}</button><button type="button" onClick={() => setSelected(new Set())} className={secondaryClass}>{text.clear}</button></div>
      <div className="mt-3 space-y-2">{stops.map((stop, index) => <label key={stop.place_id} className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm ring-1 ring-slate-200"><input type="checkbox" checked={selected.has(stop.place_id)} onChange={() => setSelected((current) => toggle(current, stop.place_id))} className="size-5 accent-teal-700" /><span className="min-w-0 break-words font-bold">{index + 1}. {stop.custom_title[locale] || getPlaceContent(stop.place, locale).name}</span></label>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="text-xs font-bold text-slate-600">{text.date}<input type="date" min={todayInSeoul()} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label>
        <button type="button" disabled={busy || !selected.size} onClick={() => void saveCourse()} className={primaryClass}><Heart size={16} aria-hidden="true" />{text.save}</button>
        <button type="button" disabled={busy || !selected.size} onClick={() => void addToTrip()} className={darkClass}><CalendarPlus size={16} aria-hidden="true" />{text.add}</button>
      </div>
      {message ? <p role="status" className="mt-3 flex items-start gap-2 text-sm font-bold text-teal-800"><Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{message}</p> : null}
      <p className="mt-3 text-xs leading-5 text-slate-500">{text.snapshot}</p>
      <Link href={withLocale("/itinerary", locale)} className="mt-3 inline-flex min-h-11 items-center text-sm font-black text-teal-700 underline underline-offset-4">{text.openTrips}</Link>
    </section>
  );
}

function buildSnapshotLayout(stops: CourseStop[], startTime: string | null) {
  let current = startTime && stops[0]?.sequence === 0 ? clockMinutes(startTime) : null;
  let previousSequence: number | null = null;
  return stops.map((stop, index) => {
    if (previousSequence !== null && stop.sequence !== previousSequence + 1) current = null;
    const plannedTime = current === null ? null : toTime(current);
    const item = { placeId: stop.place_id, dayNumber: 1, sortOrder: index, memo: "", plannedTime, stayMinutes: stop.stay_minutes, travelMinutes: stop.travel_minutes, travelMode: stop.travel_mode, sourceGuideSequence: stop.sequence };
    if (current !== null) current = stop.stay_minutes !== null && stop.travel_minutes !== null ? current + stop.stay_minutes + stop.travel_minutes : null;
    previousSequence = stop.sequence;
    return item;
  });
}
function toggle(current: Set<string>, id: string) { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }
function todayInSeoul() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function clockMinutes(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return hour * 60 + minute; }
function toTime(value: number) { const minute = value % (24 * 60); return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; }
const primaryClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-50";
const darkClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50";
const secondaryClass = "inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700";
const copy = {
  ko: { title: "코스 묶음 저장", description: "전체 또는 원하는 장소만 저장하고 개인 일정 사본을 만듭니다.", all: "전체 선택", clear: "선택 해제", date: "방문 날짜", save: "선택 저장", add: "일정에 추가", saved: "선택한 장소와 코스를 저장했습니다.", added: "개인 일정 사본을 만들었습니다.", failed: "저장하지 못했습니다. 로컬 데이터는 그대로 유지됩니다.", failedMigration: "일정을 만들지 못했습니다. DB migration 032 적용 여부를 확인해주세요.", snapshot: "일정에 추가하면 현재 순서·체류·이동시간을 복사합니다. 공식 코스가 바뀌어도 개인 일정은 자동 변경되지 않습니다.", openTrips: "내 일정 열기" },
  zh: { title: "整条路线收藏", description: "可收藏全部或部分地点，并创建个人行程副本。", all: "全选", clear: "取消选择", date: "到访日期", save: "收藏所选", add: "加入行程", saved: "已收藏所选地点和路线。", added: "已创建个人行程副本。", failed: "保存失败，本地数据仍会保留。", failedMigration: "无法创建行程，请确认已应用数据库 migration 032。", snapshot: "加入行程时会复制当前顺序、停留和交通时间。官方路线更新不会自动更改个人行程。", openTrips: "打开我的行程" },
  en: { title: "Save this course", description: "Save every stop or choose a subset, then create a personal itinerary copy.", all: "Select all", clear: "Clear", date: "Visit date", save: "Save selected", add: "Add to trip", saved: "The selected places and course were saved.", added: "A personal itinerary copy was created.", failed: "Could not save. Local data has been kept.", failedMigration: "Could not create the trip. Check that database migration 032 is applied.", snapshot: "Adding to a trip copies the current order, stay, and travel times. Later official-course edits will not alter your trip.", openTrips: "Open my trips" },
  ja: { title: "コースをまとめて保存", description: "全スポットまたは選んだ場所を保存し、個人日程のコピーを作成します。", all: "すべて選択", clear: "選択解除", date: "訪問日", save: "選択を保存", add: "日程に追加", saved: "選択した場所とコースを保存しました。", added: "個人日程のコピーを作成しました。", failed: "保存できませんでした。端末のデータは保持されています。", failedMigration: "日程を作成できませんでした。DB migration 032の適用を確認してください。", snapshot: "日程追加時に現在の順序・滞在・移動時間をコピーします。公式コース更新で個人日程は自動変更されません。", openTrips: "自分の日程を開く" },
};
