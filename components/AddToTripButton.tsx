"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarPlus, Check, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { defaultLocale, getLocaleFromPath, type Locale, withLocale } from "@/lib/i18n";
import { addPlaceToTrip, getUserTrips } from "@/lib/trip-store";
import type { TripRecord } from "@/types/database";

export function AddToTripButton({ placeId, locale }: { placeId: string; locale?: Locale }) {
  const pathname = usePathname();
  const currentLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const { user } = useAuth();
  const text = copy[currentLocale];
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    let mounted = true;
    setLoading(true);
    void getUserTrips(user.id).then((result) => {
      if (!mounted) return;
      setTrips(result.trips);
      setStatus(result.error ?? "");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [open, user]);

  async function add(trip: TripRecord) {
    setLoading(true);
    const error = await addPlaceToTrip(trip.id, placeId, 1);
    setLoading(false);
    setStatus(error ?? text.added);
  }

  if (!user) {
    return (
      <Link href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(pathname)}`} className={buttonClass}>
        <CalendarPlus size={16} aria-hidden="true" />{text.add}
      </Link>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => { setOpen((current) => !current); setStatus(""); }} className={buttonClass}>
        <CalendarPlus size={16} aria-hidden="true" />{text.add}
      </button>
      {open ? (
        <div className="absolute bottom-12 right-0 z-30 w-[min(82vw,300px)] rounded-[20px] bg-white p-3 shadow-xl ring-1 ring-slate-200">
          <p className="text-sm font-black text-slate-950">{text.choose}</p>
          {loading ? <p className="mt-3 text-xs text-slate-500">{text.loading}</p> : null}
          {!loading && trips.length ? (
            <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
              {trips.map((trip) => (
                <button key={trip.id} type="button" onClick={() => void add(trip)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 text-left text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                  <span className="truncate">{trip.title}</span><Plus size={15} className="shrink-0" />
                </button>
              ))}
            </div>
          ) : null}
          {!loading && !trips.length ? (
            <Link href={withLocale("/itinerary", currentLocale)} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-black text-white">{text.create}</Link>
          ) : null}
          {status ? <p className="mt-3 flex items-start gap-1.5 text-xs font-bold text-teal-700"><Check size={14} className="mt-0.5 shrink-0" />{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

const buttonClass = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-teal-50 px-3 text-xs font-black text-teal-800 ring-1 ring-teal-100 transition active:scale-95";

const copy = {
  ko: { add: "여행 일정에 추가", choose: "추가할 일정", loading: "일정을 불러오는 중입니다.", create: "새 일정 만들기", added: "DAY 1에 추가했습니다." },
  zh: { add: "加入旅行计划", choose: "选择计划", loading: "正在加载计划。", create: "创建新计划", added: "已加入 DAY 1。" },
  en: { add: "Add to trip", choose: "Choose a trip", loading: "Loading trips.", create: "Create a new trip", added: "Added to DAY 1." },
  ja: { add: "旅行プランに追加", choose: "追加するプラン", loading: "プランを読み込み中です。", create: "新規プラン作成", added: "DAY 1に追加しました。" },
} satisfies Record<Locale, Record<string, string>>;
