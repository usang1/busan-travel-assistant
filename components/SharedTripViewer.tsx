"use client";

import Link from "next/link";
import { CalendarDays, LockKeyhole } from "lucide-react";
import { useMemo, useState } from "react";
import { CopySharedTripButton } from "@/components/CopySharedTripButton";
import { ShareButton } from "@/components/ShareButton";
import { TripDayMap } from "@/components/TripDayMap";
import { getPlaceContent, type Locale, withLocale } from "@/lib/i18n";
import { getTripDayCount, getTripDayDate } from "@/lib/trip-planner";
import { categoryLabels, type SharedTripWithPlaces } from "@/types/database";

export function SharedTripViewer({ trip, locale }: { trip: SharedTripWithPlaces; locale: Locale }) {
  const [activeDay, setActiveDay] = useState(1);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const text = copy[locale];
  const dayCount = getTripDayCount(trip.start_date, trip.end_date);
  const dayItems = useMemo(
    () => trip.trip_places.filter((item) => item.day_number === activeDay).sort((a, b) => a.sort_order - b.sort_order),
    [activeDay, trip.trip_places],
  );

  return (
    <div className="space-y-6">
      <section className="bg-slate-950 px-5 py-6 text-white sm:rounded-[28px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-200"><LockKeyhole size={15} />{text.unlisted}</p>
            <h1 className="mt-3 text-3xl font-black tracking-normal">{trip.title}</h1>
            <p className="mt-2 text-sm text-slate-300">{trip.start_date} - {trip.end_date} · {dayCount} {text.days}</p>
          </div>
          <CalendarDays size={30} className="shrink-0 text-teal-300" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopySharedTripButton shareSlug={trip.share_slug} title={trip.title} locale={locale} />
          <ShareButton title={trip.title} text={text.shareText} locale={locale} />
        </div>
      </section>

      <section>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => (
            <button key={day} type="button" onClick={() => { setActiveDay(day); setSelectedMarkerId(null); }} className={`min-h-12 shrink-0 rounded-2xl px-4 text-left ring-1 ${activeDay === day ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"}`}>
              <span className="block text-sm font-black">DAY {day}</span>
              <span className="block text-[11px] opacity-70">{getTripDayDate(trip.start_date, day)}</span>
            </button>
          ))}
        </div>

        <TripDayMap key={activeDay} items={dayItems} locale={locale} selectedId={selectedMarkerId} onSelect={setSelectedMarkerId} />

        <div className="mt-4 space-y-3">
          {dayItems.length ? dayItems.map((item, index) => {
            const content = getPlaceContent(item.place, locale);
            return (
              <article key={item.id} className="flex items-start gap-3 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-700 text-sm font-black text-white">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={withLocale(`/places/${item.place.slug}`, locale)} className="block truncate text-base font-black text-slate-950">{content.name}</Link>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{categoryLabels[item.place.category][locale]}</p>
                  {item.memo ? <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{item.memo}</p> : null}
                </div>
              </article>
            );
          }) : <p className="rounded-[22px] bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">{text.emptyDay}</p>}
        </div>
      </section>
    </div>
  );
}

const copy = {
  ko: { unlisted: "링크로 공유된 일정", days: "일", shareText: "여행 일정을 확인해 보세요.", emptyDay: "이 날짜에는 등록된 장소가 없습니다." },
  zh: { unlisted: "通过链接分享的计划", days: "天", shareText: "查看这个旅行计划。", emptyDay: "这一天没有安排地点。" },
  en: { unlisted: "Trip shared by link", days: "days", shareText: "View this travel plan.", emptyDay: "No places are planned for this day." },
  ja: { unlisted: "リンクで共有されたプラン", days: "日", shareText: "旅行プランを確認してください。", emptyDay: "この日には場所が登録されていません。" },
} satisfies Record<Locale, Record<string, string>>;
