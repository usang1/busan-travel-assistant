"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPinned,
  Plus,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { ShareButton } from "@/components/ShareButton";
import { TripDayMap } from "@/components/TripDayMap";
import { useAuth } from "@/components/AuthProvider";
import { getPlaceContent, type Locale, withLocale } from "@/lib/i18n";
import { autoArrangeTripPlaces, getTripDayCount, getTripDayDate } from "@/lib/trip-planner";
import {
  addPlaceToTrip,
  createTrip,
  deleteTrip,
  getSavedPlacesForTrip,
  getTripPlaces,
  getUserTrips,
  normalizeTripDayOrders,
  removeTripPlace,
  saveTripLayout,
  updateTrip,
  updateTripPlace,
  type TripInput,
} from "@/lib/trip-store";
import { categoryLabels, type PlaceWithRelations, type TripPlaceWithPlace, type TripRecord, type TripVisibility } from "@/types/database";

type TripPlannerProps = { locale: Locale };

export function TripPlanner({ locale }: TripPlannerProps) {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const text = copy[locale];
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [activeTripId, setActiveTripId] = useState("");
  const [tripPlaces, setTripPlaces] = useState<TripPlaceWithPlace[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<PlaceWithRelations[]>([]);
  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<string>>(() => new Set());
  const [activeDay, setActiveDay] = useState(1);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [createForm, setCreateForm] = useState<TripInput>(() => defaultTripInput(locale));
  const [editForm, setEditForm] = useState<TripInput>(() => defaultTripInput(locale));
  const activeTrip = trips.find((trip) => trip.id === activeTripId) ?? null;
  const dayCount = activeTrip ? getTripDayCount(activeTrip.start_date, activeTrip.end_date) : 1;
  const placedIds = useMemo(() => new Set(tripPlaces.map((item) => item.place_id)), [tripPlaces]);
  const dayItems = useMemo(
    () => tripPlaces.filter((item) => item.day_number === activeDay).sort((a, b) => a.sort_order - b.sort_order),
    [activeDay, tripPlaces],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) {
        if (mounted) {
          setTrips([]);
          setSavedPlaces([]);
          setInitialLoading(false);
        }
        return;
      }

      setInitialLoading(true);
      const [tripResult, saved] = await Promise.all([getUserTrips(user.id), getSavedPlacesForTrip(user.id)]);
      if (!mounted) return;
      setTrips(tripResult.trips);
      setSavedPlaces(saved);
      setStatus(tripResult.error ?? "");
      const requestedTrip = searchParams.get("trip");
      const nextId = requestedTrip && tripResult.trips.some((trip) => trip.id === requestedTrip)
        ? requestedTrip
        : tripResult.trips[0]?.id ?? "";
      setActiveTripId(nextId);
      setInitialLoading(false);
    }

    void load();
    return () => { mounted = false; };
  }, [searchParams, user]);

  useEffect(() => {
    let mounted = true;
    const trip = trips.find((item) => item.id === activeTripId);
    if (!trip) {
      setTripPlaces([]);
      return;
    }

    setEditForm(toTripInput(trip));
    setActiveDay((current) => Math.min(current, getTripDayCount(trip.start_date, trip.end_date)));
    void getTripPlaces(trip.id).then((items) => {
      if (mounted) setTripPlaces(normalizeTripDayOrders(items));
    });
    return () => { mounted = false; };
  }, [activeTripId, trips]);

  if (authLoading || initialLoading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{text.loading}</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title={text.loginTitle} description={text.loginDescription} locale={locale} />;
  }

  async function refreshTripPlaces(tripId = activeTripId) {
    if (!tripId) return;
    setTripPlaces(normalizeTripDayOrders(await getTripPlaces(tripId)));
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setStatus("");
    const result = await createTrip(user.id, createForm);
    setBusy(false);
    if (!result.trip) {
      setStatus(result.error ?? text.failed);
      return;
    }
    setTrips((current) => [result.trip as TripRecord, ...current]);
    setActiveTripId(result.trip.id);
    setCreateForm(defaultTripInput(locale));
    setStatus(text.created);
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTrip || busy) return;
    setBusy(true);
    const result = await updateTrip(activeTrip.id, editForm);
    if (result.trip) {
      const newDayCount = getTripDayCount(result.trip.start_date, result.trip.end_date);
      const clampedLayout = tripPlaces.map((item) => ({
        placeId: item.place_id,
        dayNumber: Math.min(item.day_number, newDayCount),
        sortOrder: item.sort_order,
        memo: item.memo,
      }));
      const layoutError = await saveTripLayout(activeTrip.id, clampedLayout);
      setTrips((current) => current.map((trip) => trip.id === result.trip?.id ? result.trip as TripRecord : trip));
      await refreshTripPlaces(activeTrip.id);
      setStatus(layoutError ?? text.saved);
    } else {
      setStatus(result.error ?? text.failed);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!activeTrip || !window.confirm(text.deleteConfirm)) return;
    setBusy(true);
    const error = await deleteTrip(activeTrip.id);
    if (error) {
      setStatus(error);
    } else {
      const remaining = trips.filter((trip) => trip.id !== activeTrip.id);
      setTrips(remaining);
      setActiveTripId(remaining[0]?.id ?? "");
      setTripPlaces([]);
      setStatus(text.deleted);
    }
    setBusy(false);
  }

  async function handleAdd(placeId: string) {
    if (!activeTrip) return;
    setBusy(true);
    const error = await addPlaceToTrip(activeTrip.id, placeId, activeDay);
    await refreshTripPlaces();
    setBusy(false);
    setStatus(error ?? text.placeAdded);
  }

  async function handleAutoArrange() {
    if (!activeTrip || selectedSavedIds.size === 0) return;
    setBusy(true);
    const selected = savedPlaces.filter((place) => selectedSavedIds.has(place.id));
    const allPlaces = Array.from(new Map(
      [...tripPlaces.map((item) => item.place), ...selected].map((place) => [place.id, place]),
    ).values());
    const positions = autoArrangeTripPlaces(allPlaces, dayCount);
    const memoByPlace = new Map(tripPlaces.map((item) => [item.place_id, item.memo]));
    const error = await saveTripLayout(activeTrip.id, positions.map((position) => ({
      ...position,
      memo: memoByPlace.get(position.placeId) ?? "",
    })));
    await refreshTripPlaces();
    setSelectedSavedIds(new Set());
    setActiveDay(1);
    setBusy(false);
    setStatus(error ?? text.arranged);
  }

  async function moveItem(item: TripPlaceWithPlace, direction: -1 | 1) {
    const items = dayItems;
    const index = items.findIndex((current) => current.id === item.id);
    const other = items[index + direction];
    if (!other) return;
    setBusy(true);
    const [firstError, secondError] = await Promise.all([
      updateTripPlace(item.id, { sort_order: other.sort_order }),
      updateTripPlace(other.id, { sort_order: item.sort_order }),
    ]);
    await refreshTripPlaces();
    setBusy(false);
    setStatus(firstError ?? secondError ?? "");
  }

  async function moveToDay(item: TripPlaceWithPlace, nextDay: number) {
    const targetItems = tripPlaces.filter((current) => current.day_number === nextDay);
    const nextOrder = Math.max(-1, ...targetItems.map((current) => current.sort_order)) + 1;
    setBusy(true);
    const error = await updateTripPlace(item.id, { day_number: nextDay, sort_order: nextOrder });
    await refreshTripPlaces();
    setBusy(false);
    setStatus(error ?? "");
  }

  async function saveMemo(item: TripPlaceWithPlace) {
    const error = await updateTripPlace(item.id, { memo: item.memo.trim() });
    if (error) setStatus(error);
  }

  async function handleRemove(item: TripPlaceWithPlace) {
    setBusy(true);
    const error = await removeTripPlace(item.id);
    await refreshTripPlaces();
    setBusy(false);
    setStatus(error ?? text.placeRemoved);
  }

  return (
    <div className="space-y-6">
      <section className="bg-slate-950 px-5 py-6 text-white sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-teal-200">{text.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">{text.title}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{text.description}</p>
          </div>
          <CalendarDays className="shrink-0 text-teal-300" size={30} aria-hidden="true" />
        </div>
      </section>

      <section>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              onClick={() => { setActiveTripId(trip.id); setActiveDay(1); setStatus(""); }}
              className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black ring-1 ${activeTripId === trip.id ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-slate-200"}`}
            >
              {trip.title}
            </button>
          ))}
          <details className="group shrink-0">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200">
              <Plus size={16} aria-hidden="true" />{text.newTrip}
            </summary>
            <form onSubmit={handleCreate} className="mt-3 w-[min(88vw,420px)] space-y-3 rounded-[24px] bg-white p-4 shadow-lg ring-1 ring-slate-200">
              <TripFields value={createForm} locale={locale} onChange={setCreateForm} />
              <button disabled={busy} className={primaryButtonClass}><Plus size={17} />{text.create}</button>
            </form>
          </details>
        </div>
      </section>

      {status ? <p role="status" className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 ring-1 ring-teal-100">{status}</p> : null}

      {!activeTrip ? (
        <section className="rounded-[24px] bg-white p-6 text-center ring-1 ring-slate-200">
          <MapPinned className="mx-auto text-slate-400" size={28} />
          <h2 className="mt-3 text-xl font-black text-slate-950">{text.emptyTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{text.emptyDescription}</p>
        </section>
      ) : (
        <>
          <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <form onSubmit={handleUpdate}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">{activeTrip.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{activeTrip.start_date} - {activeTrip.end_date}</p>
                </div>
                <div className="flex gap-2">
                  {activeTrip.visibility === "unlisted" ? (
                    <ShareButton
                      title={activeTrip.title}
                      text={text.shareText}
                      url={withLocale(`/trip/${activeTrip.share_slug}`, locale)}
                      locale={locale}
                    />
                  ) : null}
                  <button type="button" onClick={() => void handleDelete()} disabled={busy} className="grid size-11 place-items-center rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                    <Trash2 size={17} aria-hidden="true" />
                    <span className="sr-only">{text.delete}</span>
                  </button>
                </div>
              </div>
              <div className="mt-5"><TripFields value={editForm} locale={locale} onChange={setEditForm} /></div>
              <button disabled={busy} className={`mt-4 ${primaryButtonClass}`}><Save size={17} />{text.saveTrip}</button>
            </form>
          </section>

          <section>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => { setActiveDay(day); setSelectedMarkerId(null); }}
                  className={`min-h-12 shrink-0 rounded-2xl px-4 text-left ring-1 ${activeDay === day ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"}`}
                >
                  <span className="block text-sm font-black">DAY {day}</span>
                  <span className="block text-[11px] opacity-70">{getTripDayDate(activeTrip.start_date, day)}</span>
                </button>
              ))}
            </div>

            <TripDayMap key={activeDay} items={dayItems} locale={locale} selectedId={selectedMarkerId} onSelect={setSelectedMarkerId} />

            <div className="mt-4 space-y-3">
              {dayItems.length ? dayItems.map((item, index) => {
                const content = getPlaceContent(item.place, locale);
                return (
                  <article key={item.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-700 text-sm font-black text-white">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={withLocale(`/places/${item.place.slug}`, locale)} className="block truncate text-base font-black text-slate-950">{content.name}</Link>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{categoryLabels[item.place.category][locale]}</p>
                      </div>
                      <div className="flex gap-1">
                        <IconButton label={text.moveUp} disabled={busy || index === 0} onClick={() => void moveItem(item, -1)} icon={ChevronUp} />
                        <IconButton label={text.moveDown} disabled={busy || index === dayItems.length - 1} onClick={() => void moveItem(item, 1)} icon={ChevronDown} />
                        <IconButton label={text.remove} disabled={busy} onClick={() => void handleRemove(item)} icon={Trash2} danger />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                      <label className="text-xs font-bold text-slate-600">
                        {text.day}
                        <select value={item.day_number} onChange={(event) => void moveToDay(item, Number(event.target.value))} className={smallInputClass}>
                          {Array.from({ length: dayCount }, (_, dayIndex) => <option key={dayIndex + 1} value={dayIndex + 1}>DAY {dayIndex + 1}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-600">
                        {text.memo}
                        <input
                          value={item.memo}
                          onChange={(event) => setTripPlaces((current) => current.map((target) => target.id === item.id ? { ...target, memo: event.target.value } : target))}
                          onBlur={() => void saveMemo(item)}
                          maxLength={500}
                          placeholder={text.memoPlaceholder}
                          className={smallInputClass}
                        />
                      </label>
                    </div>
                  </article>
                );
              }) : <p className="rounded-[22px] bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">{text.noPlacesDay}</p>}
            </div>
          </section>

          <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">{text.savedPlaces}</h2>
                <p className="mt-1 text-sm text-slate-500">{text.autoDescription}</p>
              </div>
              <button type="button" disabled={busy || selectedSavedIds.size === 0} onClick={() => void handleAutoArrange()} className={primaryButtonClass}>
                <WandSparkles size={17} />{text.autoArrange}
              </button>
            </div>
            {savedPlaces.length ? (
              <div className="mt-4 space-y-2">
                {savedPlaces.map((place) => {
                  const content = getPlaceContent(place, locale);
                  const placed = placedIds.has(place.id);
                  const selected = selectedSavedIds.has(place.id);
                  return (
                    <div key={place.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <label className="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          disabled={placed}
                          checked={selected}
                          onChange={() => setSelectedSavedIds((current) => toggleSet(current, place.id))}
                          className="size-5 accent-teal-700"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-slate-950">{content.name}</span>
                          <span className="block text-xs text-slate-500">{categoryLabels[place.category][locale]}{placed ? ` · ${text.alreadyAdded}` : ""}</span>
                        </span>
                      </label>
                      {!placed ? (
                        <button type="button" disabled={busy} onClick={() => void handleAdd(place.id)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-white px-3 text-xs font-black text-teal-700 ring-1 ring-teal-100">
                          <Plus size={15} />DAY {activeDay}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-4 text-sm text-slate-500">{text.noSavedPlaces}</p>}
          </section>
        </>
      )}
    </div>
  );
}

function TripFields({ value, locale, onChange }: { value: TripInput; locale: Locale; onChange: (value: TripInput) => void }) {
  const text = copy[locale];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className={labelClass}>{text.tripTitle}</span><input required maxLength={120} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} className={inputClass} /></label>
      <label><span className={labelClass}>{text.startDate}</span><input required type="date" value={value.startDate} onChange={(event) => onChange({ ...value, startDate: event.target.value })} className={inputClass} /></label>
      <label><span className={labelClass}>{text.endDate}</span><input required type="date" min={value.startDate} value={value.endDate} onChange={(event) => onChange({ ...value, endDate: event.target.value })} className={inputClass} /></label>
      <label className="sm:col-span-2"><span className={labelClass}>{text.visibility}</span><select value={value.visibility} onChange={(event) => onChange({ ...value, visibility: event.target.value as TripVisibility })} className={inputClass}><option value="private">{text.private}</option><option value="unlisted">{text.unlisted}</option></select></label>
    </div>
  );
}

function IconButton({ label, disabled, onClick, icon: Icon, danger = false }: { label: string; disabled: boolean; onClick: () => void; icon: typeof ChevronUp; danger?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} title={label} aria-label={label} className={`grid size-9 place-items-center rounded-full ring-1 disabled:opacity-35 ${danger ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-white text-slate-600 ring-slate-200"}`}><Icon size={16} /></button>;
}

function defaultTripInput(locale: Locale): TripInput {
  const start = localDate(0);
  return { title: copy[locale].defaultTitle, startDate: start, endDate: localDate(2), visibility: "private" };
}

function toTripInput(trip: TripRecord): TripInput {
  return { title: trip.title, startDate: trip.start_date, endDate: trip.end_date, visibility: trip.visibility };
}

function localDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toggleSet(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

const primaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-50";
const inputClass = "mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-teal-300";
const smallInputClass = "mt-1.5 h-11 w-full rounded-xl bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-teal-300";
const labelClass = "block text-sm font-black text-slate-700";

const copy = {
  ko: { eyebrow: "저장 장소로 만드는 일정", title: "내 여행 일정", description: "저장한 장소를 날짜별로 배치하고 이동 순서를 직접 조정하세요.", loading: "여행 일정을 불러오는 중입니다.", loginTitle: "여행 일정을 만들려면 로그인하세요", loginDescription: "로그인하면 여러 일정을 만들고 비공개로 관리하거나 링크로 공유할 수 있습니다.", newTrip: "새 일정", create: "일정 만들기", created: "새 일정을 만들었습니다.", failed: "일정 처리에 실패했습니다.", emptyTitle: "아직 여행 일정이 없습니다", emptyDescription: "새 일정을 만들고 저장한 장소를 추가해 보세요.", tripTitle: "일정 제목", startDate: "시작일", endDate: "종료일", visibility: "공개 범위", private: "비공개", unlisted: "링크가 있는 사람만", saveTrip: "일정 정보 저장", saved: "일정을 저장했습니다.", delete: "일정 삭제", deleteConfirm: "이 일정을 삭제할까요?", deleted: "일정을 삭제했습니다.", shareText: "여행 일정을 확인해 보세요.", moveUp: "위로 이동", moveDown: "아래로 이동", remove: "일정에서 제거", day: "날짜", memo: "메모", memoPlaceholder: "예약 시간, 주문할 메뉴 등", noPlacesDay: "이 날짜에는 아직 장소가 없습니다.", savedPlaces: "저장한 장소", autoDescription: "여러 장소를 선택하면 거리, 카테고리와 확인된 영업시간을 기준으로 날짜별 초안을 만듭니다.", autoArrange: "자동 배치", arranged: "선택한 장소를 자동 배치했습니다.", placeAdded: "일정에 장소를 추가했습니다.", placeRemoved: "일정에서 장소를 제거했습니다.", alreadyAdded: "추가됨", noSavedPlaces: "저장한 장소가 없습니다.", defaultTitle: "한국 여행" },
  zh: { eyebrow: "用收藏地点安排行程", title: "我的旅行计划", description: "把收藏的地点分配到每天，并可自行调整游览顺序。", loading: "正在加载旅行计划。", loginTitle: "登录后创建旅行计划", loginDescription: "登录后可创建多个计划，设为私密或通过链接分享。", newTrip: "新计划", create: "创建计划", created: "已创建新计划。", failed: "行程处理失败。", emptyTitle: "还没有旅行计划", emptyDescription: "新建计划并添加收藏地点。", tripTitle: "计划名称", startDate: "开始日期", endDate: "结束日期", visibility: "可见范围", private: "仅自己可见", unlisted: "仅链接访问", saveTrip: "保存计划信息", saved: "计划已保存。", delete: "删除计划", deleteConfirm: "确定删除这个计划吗？", deleted: "计划已删除。", shareText: "查看这个旅行计划。", moveUp: "上移", moveDown: "下移", remove: "从计划移除", day: "日期", memo: "备注", memoPlaceholder: "预约时间、想点的菜单等", noPlacesDay: "这一天还没有地点。", savedPlaces: "收藏的地点", autoDescription: "选择多个地点后，按距离、类别和已确认的营业时间生成每日草案。", autoArrange: "自动安排", arranged: "已自动安排所选地点。", placeAdded: "地点已加入计划。", placeRemoved: "地点已移出计划。", alreadyAdded: "已添加", noSavedPlaces: "还没有收藏地点。", defaultTitle: "韩国旅行" },
  en: { eyebrow: "Plan with saved places", title: "My trips", description: "Assign saved places to each day and adjust the visit order.", loading: "Loading trips.", loginTitle: "Sign in to plan a trip", loginDescription: "Create multiple private trips or share one with an unlisted link.", newTrip: "New trip", create: "Create trip", created: "Trip created.", failed: "The trip could not be updated.", emptyTitle: "No trips yet", emptyDescription: "Create a trip and add your saved places.", tripTitle: "Trip title", startDate: "Start date", endDate: "End date", visibility: "Visibility", private: "Private", unlisted: "Anyone with the link", saveTrip: "Save trip details", saved: "Trip saved.", delete: "Delete trip", deleteConfirm: "Delete this trip?", deleted: "Trip deleted.", shareText: "View this travel plan.", moveUp: "Move up", moveDown: "Move down", remove: "Remove from trip", day: "Day", memo: "Memo", memoPlaceholder: "Reservation time, menu to order, etc.", noPlacesDay: "No places have been added to this day.", savedPlaces: "Saved places", autoDescription: "Select places to create a draft using distance, category, and known opening hours.", autoArrange: "Auto arrange", arranged: "Selected places were arranged.", placeAdded: "Place added to the trip.", placeRemoved: "Place removed from the trip.", alreadyAdded: "Added", noSavedPlaces: "No saved places yet.", defaultTitle: "Korea trip" },
  ja: { eyebrow: "保存した場所で日程作成", title: "旅行プラン", description: "保存した場所を日ごとに配置し、訪問順を調整できます。", loading: "旅行プランを読み込んでいます。", loginTitle: "ログインして旅行プランを作成", loginDescription: "複数のプランを作成し、非公開またはリンク限定で共有できます。", newTrip: "新規プラン", create: "プラン作成", created: "新しいプランを作成しました。", failed: "プランを更新できませんでした。", emptyTitle: "旅行プランはまだありません", emptyDescription: "新しいプランを作り、保存した場所を追加してください。", tripTitle: "プラン名", startDate: "開始日", endDate: "終了日", visibility: "公開範囲", private: "非公開", unlisted: "リンク限定", saveTrip: "プラン情報を保存", saved: "プランを保存しました。", delete: "プラン削除", deleteConfirm: "このプランを削除しますか？", deleted: "プランを削除しました。", shareText: "旅行プランを確認してください。", moveUp: "上へ", moveDown: "下へ", remove: "プランから削除", day: "日付", memo: "メモ", memoPlaceholder: "予約時間、注文するメニューなど", noPlacesDay: "この日にはまだ場所がありません。", savedPlaces: "保存した場所", autoDescription: "複数の場所を選択し、距離、カテゴリ、確認済みの営業時間で日程案を作成します。", autoArrange: "自動配置", arranged: "選択した場所を自動配置しました。", placeAdded: "場所をプランに追加しました。", placeRemoved: "場所をプランから削除しました。", alreadyAdded: "追加済み", noSavedPlaces: "保存した場所がありません。", defaultTitle: "韓国旅行" },
} satisfies Record<Locale, Record<string, string>>;
