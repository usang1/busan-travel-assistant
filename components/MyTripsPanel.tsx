"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Link2, LockKeyhole, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { type Locale, withLocale } from "@/lib/i18n";
import { getUserTrips } from "@/lib/trip-store";
import type { TripRecord } from "@/types/database";

export function MyTripsPanel({ locale }: { locale: Locale }) {
  const { user } = useAuth();
  const text = copy[locale];
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setFailed(false);
    void getUserTrips(user.id).then((result) => {
      if (!mounted) return;
      setTrips(result.trips);
      setFailed(Boolean(result.error));
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [user]);

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">{text.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.description}</p>
        </div>
        <Link href={withLocale("/itinerary", locale)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-teal-700 px-3 text-sm font-black text-white transition active:scale-95">
          <Plus size={16} aria-hidden="true" />{text.create}
        </Link>
      </div>

      {loading ? <p className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">{text.loading}</p> : null}
      {!loading && failed ? <p role="alert" className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-100">{text.failed}</p> : null}

      {!loading && trips.length ? (
        <div className="mt-4 space-y-3">
          {trips.slice(0, 3).map((trip) => {
            const VisibilityIcon = trip.visibility === "private" ? LockKeyhole : Link2;
            return (
              <Link
                key={trip.id}
                href={`${withLocale("/itinerary", locale)}?trip=${encodeURIComponent(trip.id)}`}
                className="flex min-h-20 items-center gap-3 rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-teal-200 active:scale-[0.99]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  <CalendarDays size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-black text-slate-950">{trip.title}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{trip.start_date} - {trip.end_date}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                    <VisibilityIcon size={13} aria-hidden="true" />
                    {trip.visibility === "private" ? text.private : text.unlisted}
                  </span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            );
          })}
          {trips.length > 3 ? (
            <Link href={withLocale("/itinerary", locale)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-black text-teal-700">
              {text.viewAll} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}

      {!loading && !failed && !trips.length ? (
        <div className="mt-4 rounded-[20px] bg-white p-5 text-center ring-1 ring-slate-200">
          <CalendarDays size={24} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-black text-slate-800">{text.empty}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{text.emptyDescription}</p>
        </div>
      ) : null}
    </section>
  );
}

const copy = {
  ko: { title: "내 여행 일정", description: "만든 일정을 확인하고 계속 편집하세요.", create: "새 일정", loading: "여행 일정을 불러오는 중입니다.", failed: "여행 일정을 불러오지 못했습니다.", private: "비공개", unlisted: "링크 공유", viewAll: "전체 일정 보기", empty: "아직 만든 일정이 없습니다", emptyDescription: "새 일정을 만들고 저장한 장소를 날짜별로 배치해 보세요." },
  zh: { title: "我的旅行计划", description: "查看并继续编辑已创建的计划。", create: "新计划", loading: "正在加载旅行计划。", failed: "无法加载旅行计划。", private: "仅自己可见", unlisted: "链接分享", viewAll: "查看全部计划", empty: "还没有旅行计划", emptyDescription: "创建计划后，把收藏地点安排到每天。" },
  en: { title: "My trips", description: "Review and continue editing your trips.", create: "New trip", loading: "Loading trips.", failed: "Trips could not be loaded.", private: "Private", unlisted: "Shared by link", viewAll: "View all trips", empty: "No trips yet", emptyDescription: "Create a trip and arrange saved places by day." },
  ja: { title: "旅行プラン", description: "作成したプランを確認し、編集を続けられます。", create: "新規", loading: "旅行プランを読み込み中です。", failed: "旅行プランを読み込めませんでした。", private: "非公開", unlisted: "リンク共有", viewAll: "すべてのプラン", empty: "旅行プランはまだありません", emptyDescription: "プランを作成し、保存した場所を日ごとに配置してください。" },
} satisfies Record<Locale, Record<string, string>>;
