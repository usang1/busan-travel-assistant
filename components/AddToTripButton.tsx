"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Check, Plus, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addGuestPlaceToTrip, createGuestTrip, readGuestTripStore } from "@/lib/guest-trips";
import { defaultLocale, getLocaleFromPath, type Locale, withLocale } from "@/lib/i18n";
import { addPlaceToTrip, createTrip, getTripPlaces, getUserTrips, type TripInput } from "@/lib/trip-store";
import type { TripRecord } from "@/types/database";

export function AddToTripButton({ placeId, locale }: { placeId: string; locale?: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const { user, loading: authLoading } = useAuth();
  const text = copy[currentLocale];
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"success" | "error" | "neutral">("neutral");
  const [lastTripId, setLastTripId] = useState("");
  const [createForm, setCreateForm] = useState<TripInput>(() => defaultTripInput(currentLocale));
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nextPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    if (!open) return;

    window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>("button, a, input, select, textarea");
      first?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function handleOpen() {
    if (authLoading || loading) return;
    setStatus("");
    setStatusTone("neutral");
    setLastTripId("");

    if (user) {
      setLoading(true);
      const result = await getUserTrips(user.id);
      setLoading(false);
      setTrips(result.trips);

      if (result.error) {
        setStatus(result.error);
        setStatusTone("error");
        setOpen(true);
        return;
      }

      if (result.trips.length === 1) {
        await addToUserTrip(result.trips[0]);
        return;
      }

      setOpen(true);
      return;
    }

    try {
      const store = readGuestTripStore();
      setTrips(store.trips);

      if (store.trips.length === 1) {
        addToGuestTrip(store.trips[0]);
        return;
      }

      setCreateForm(defaultTripInput(currentLocale));
      setOpen(true);
    } catch {
      setStatus(text.storageFailed);
      setStatusTone("error");
    }
  }

  async function addToUserTrip(trip: TripRecord) {
    setLoading(true);
    setStatus("");

    const existing = await getTripPlaces(trip.id);
    if (existing.some((item) => item.place_id === placeId)) {
      setLoading(false);
      setLastTripId(trip.id);
      setStatus(text.duplicate);
      setStatusTone("neutral");
      return;
    }

    const error = await addPlaceToTrip(trip.id, placeId, 1);
    setLoading(false);

    if (error) {
      setStatus(error);
      setStatusTone("error");
      return;
    }

    setLastTripId(trip.id);
    setStatus(text.added);
    setStatusTone("success");
  }

  function addToGuestTrip(trip: TripRecord) {
    try {
      const result = addGuestPlaceToTrip(trip.id, placeId, 1);
      setLastTripId(trip.id);
      setStatus(result.status === "duplicate" ? text.duplicate : text.added);
      setStatusTone(result.status === "duplicate" ? "neutral" : "success");
    } catch {
      setStatus(text.storageFailed);
      setStatusTone("error");
    }
  }

  async function handleCreateTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (user) {
      setLoading(true);
      const result = await createTrip(user.id, createForm);

      if (!result.trip) {
        setLoading(false);
        setStatus(result.error ?? text.storageFailed);
        setStatusTone("error");
        return;
      }

      const error = await addPlaceToTrip(result.trip.id, placeId, 1);
      setLoading(false);

      if (error) {
        setTrips((current) => [result.trip as TripRecord, ...current]);
        setLastTripId(result.trip.id);
        setStatus(error);
        setStatusTone("error");
        return;
      }

      setTrips((current) => [result.trip as TripRecord, ...current]);
      setLastTripId(result.trip.id);
      setStatus(text.createdAndAdded);
      setStatusTone("success");
      setCreateForm(defaultTripInput(currentLocale));
      return;
    }

    try {
      setLoading(true);
      const trip = createGuestTrip(createForm);
      const result = addGuestPlaceToTrip(trip.id, placeId, 1);
      setTrips((current) => [trip, ...current]);
      setLastTripId(trip.id);
      setStatus(result.status === "duplicate" ? text.duplicate : text.createdAndAdded);
      setStatusTone(result.status === "duplicate" ? "neutral" : "success");
      setCreateForm(defaultTripInput(currentLocale));
      setLoading(false);
    } catch {
      setLoading(false);
      setStatus(text.storageFailed);
      setStatusTone("error");
    }
  }

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void handleOpen()}
        disabled={authLoading || loading}
        className={buttonClass}
      >
        <CalendarPlus size={16} aria-hidden="true" />{loading ? text.loadingShort : text.add}
      </button>

      {!open && status ? <TripStatus text={status} tone={statusTone} tripId={lastTripId} locale={currentLocale} viewLabel={text.viewTrip} /> : null}

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 px-3 py-4 backdrop-blur-sm sm:grid sm:place-items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-to-trip-title"
            className="fixed inset-x-0 bottom-0 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-t-[28px] bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl outline-none sm:static sm:w-[min(92vw,420px)] sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="add-to-trip-title" className="text-lg font-black text-slate-950">{trips.length ? text.choose : text.createTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{user ? text.userHint : text.guestHint}</p>
              </div>
              <button type="button" onClick={closeDialog} className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                <X size={17} aria-hidden="true" />
                <span className="sr-only">{text.close}</span>
              </button>
            </div>

            {loading ? <p className="mt-4 text-sm font-semibold text-slate-500">{text.loading}</p> : null}

            {!loading && !trips.length ? (
              <form onSubmit={(event) => void handleCreateTrip(event)} className="mt-4 space-y-3">
                <TripFields value={createForm} locale={currentLocale} onChange={setCreateForm} />
                <button type="submit" disabled={loading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-60">
                  <Plus size={17} aria-hidden="true" />{text.createAndAdd}
                </button>
              </form>
            ) : null}

            {!loading && trips.length > 1 ? (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {trips.map((trip) => (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => user ? void addToUserTrip(trip) : addToGuestTrip(trip)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 text-left text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition focus:outline-none focus:ring-4 focus:ring-teal-100"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{trip.title}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-slate-400">{trip.start_date} - {trip.end_date}</span>
                    </span>
                    <Plus size={15} className="shrink-0 text-teal-700" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}

            {status ? <TripStatus text={status} tone={statusTone} tripId={lastTripId} locale={currentLocale} viewLabel={text.viewTrip} inline /> : null}

            {!user ? (
              <div className="mt-4 rounded-2xl bg-teal-50 px-3 py-3 text-xs font-semibold leading-5 text-teal-900 ring-1 ring-teal-100">
                {text.syncHint}
                <Link href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(nextPath)}`} className="ml-1 font-black underline underline-offset-4">
                  {text.loginToSync}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TripStatus({
  text,
  tone,
  tripId,
  locale,
  viewLabel,
  inline = false,
}: {
  text: string;
  tone: "success" | "error" | "neutral";
  tripId: string;
  locale: Locale;
  viewLabel: string;
  inline?: boolean;
}) {
  const toneClass = tone === "error"
    ? "bg-rose-50 text-rose-800 ring-rose-100"
    : tone === "success"
      ? "bg-teal-50 text-teal-800 ring-teal-100"
      : "bg-slate-50 text-slate-700 ring-slate-200";
  const href = `${withLocale("/itinerary", locale)}${tripId ? `?trip=${encodeURIComponent(tripId)}` : ""}`;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={[
        "rounded-2xl px-3 py-2 text-xs font-bold leading-5 shadow-sm ring-1",
        toneClass,
        inline ? "mt-4" : "absolute bottom-12 right-0 z-30 w-[min(82vw,260px)]",
      ].join(" ")}
    >
      <span className="flex items-start gap-1.5">
        <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </span>
      {tripId ? (
        <Link href={href} className="mt-2 inline-flex min-h-9 items-center rounded-xl bg-white px-3 text-xs font-black text-teal-800 ring-1 ring-teal-100">
          {viewLabel}
        </Link>
      ) : null}
    </div>
  );
}

function TripFields({ value, locale, onChange }: { value: TripInput; locale: Locale; onChange: (value: TripInput) => void }) {
  const text = copy[locale];

  return (
    <div className="grid gap-3">
      <label>
        <span className={labelClass}>{text.tripTitle}</span>
        <input required maxLength={120} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelClass}>{text.startDate}</span>
          <input required type="date" value={value.startDate} onChange={(event) => onChange({ ...value, startDate: event.target.value })} className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>{text.endDate}</span>
          <input required type="date" min={value.startDate} value={value.endDate} onChange={(event) => onChange({ ...value, endDate: event.target.value })} className={inputClass} />
        </label>
      </div>
    </div>
  );
}

function defaultTripInput(locale: Locale): TripInput {
  const start = localDate(0);
  return { title: copy[locale].defaultTitle, startDate: start, endDate: localDate(2), visibility: "private" };
}

function localDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"))
    .filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
}

const buttonClass = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-teal-50 px-3 text-xs font-black text-teal-800 ring-1 ring-teal-100 transition active:scale-95 disabled:opacity-60";
const inputClass = "mt-1.5 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-4 focus:ring-teal-100";
const labelClass = "block text-sm font-black text-slate-700";

const copy = {
  ko: {
    add: "여행 일정에 추가",
    choose: "추가할 일정",
    createTitle: "새 일정 만들기",
    loading: "일정을 불러오는 중입니다.",
    loadingShort: "처리 중",
    create: "일정 페이지에서 만들기",
    createAndAdd: "일정 만들고 추가",
    createdAndAdded: "새 일정에 장소를 추가했습니다.",
    added: "일정에 장소를 추가했습니다.",
    duplicate: "이미 이 일정에 추가된 장소입니다.",
    storageFailed: "이 기기의 일정 저장소에 저장하지 못했습니다. 기존 저장 데이터는 유지됩니다.",
    viewTrip: "일정 보기",
    close: "닫기",
    tripTitle: "일정 제목",
    startDate: "시작일",
    endDate: "종료일",
    guestHint: "로그인 없이 이 기기에 저장되는 일정입니다.",
    userHint: "계정에 저장된 일정에 추가합니다.",
    syncHint: "다른 기기에서도 보려면 로그인하세요.",
    loginToSync: "로그인",
    defaultTitle: "부산 여행",
  },
  zh: {
    add: "加入旅行计划",
    choose: "选择计划",
    createTitle: "创建新计划",
    loading: "正在加载计划。",
    loadingShort: "处理中",
    create: "到计划页创建",
    createAndAdd: "创建并加入",
    createdAndAdded: "已创建计划并加入地点。",
    added: "地点已加入计划。",
    duplicate: "这个地点已在该计划中。",
    storageFailed: "无法保存到此设备的计划。本机已有数据不会被删除。",
    viewTrip: "查看计划",
    close: "关闭",
    tripTitle: "计划名称",
    startDate: "开始日期",
    endDate: "结束日期",
    guestHint: "未登录时计划会保存在此设备。",
    userHint: "加入已保存在账号中的计划。",
    syncHint: "需要在其他设备查看时可登录同步。",
    loginToSync: "登录",
    defaultTitle: "釜山旅行",
  },
  en: {
    add: "Add to trip",
    choose: "Choose a trip",
    createTitle: "Create a trip",
    loading: "Loading trips.",
    loadingShort: "Working",
    create: "Create on itinerary page",
    createAndAdd: "Create and add",
    createdAndAdded: "Trip created and place added.",
    added: "Place added to the trip.",
    duplicate: "This place is already in that trip.",
    storageFailed: "Could not save to this device. Existing local trip data was not deleted.",
    viewTrip: "View trip",
    close: "Close",
    tripTitle: "Trip title",
    startDate: "Start date",
    endDate: "End date",
    guestHint: "Without signing in, this trip is saved on this device.",
    userHint: "Add to a trip saved in your account.",
    syncHint: "Sign in only if you want this available on other devices.",
    loginToSync: "Sign in",
    defaultTitle: "Busan trip",
  },
  ja: {
    add: "旅行プランに追加",
    choose: "追加するプラン",
    createTitle: "新規プラン作成",
    loading: "プランを読み込み中です。",
    loadingShort: "処理中",
    create: "プランページで作成",
    createAndAdd: "作成して追加",
    createdAndAdded: "新しいプランに場所を追加しました。",
    added: "場所をプランに追加しました。",
    duplicate: "この場所はすでにプランに追加済みです。",
    storageFailed: "この端末のプランに保存できませんでした。既存の保存データは削除されません。",
    viewTrip: "プランを見る",
    close: "閉じる",
    tripTitle: "プラン名",
    startDate: "開始日",
    endDate: "終了日",
    guestHint: "ログインしていない場合、この端末に保存されます。",
    userHint: "アカウントに保存済みのプランに追加します。",
    syncHint: "他の端末でも見る場合のみログインしてください。",
    loginToSync: "ログイン",
    defaultTitle: "釜山旅行",
  },
} satisfies Record<Locale, Record<string, string>>;
