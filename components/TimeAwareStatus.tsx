"use client";

import { AlertTriangle, Camera, Clock3, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { formatTimeAwarePrimary, getTimeAwareNotices, getTimeAwarePlaceState } from "@/lib/time-aware-place";
import type { PlaceWithRelations } from "@/types/database";

export function TimeAwareStatus({ place, locale, travelMinutes = 0, variant = "compact" }: { place: PlaceWithRelations; locale: Locale; travelMinutes?: number | null; variant?: "compact" | "detail" }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const state = useMemo(() => now ? getTimeAwarePlaceState(place, { now, travelMinutes }) : null, [now, place, travelMinutes]);
  if (!place.operating_profile || !state?.hasStructuredData) return null;
  const primary = formatTimeAwarePrimary(state, locale);
  const notices = getTimeAwareNotices(state, locale);
  const toneClass = primary.tone === "positive" ? "bg-emerald-50 text-emerald-900 ring-emerald-200" : primary.tone === "warning" ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-slate-100 text-slate-800 ring-slate-200";

  if (variant === "compact") {
    return (
      <div className={`mt-2 flex items-start gap-2 rounded-md px-3 py-2 text-xs font-black leading-5 ring-1 ${toneClass}`} role="status">
        <Clock3 size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{primary.text}</span>
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200" aria-label={timeCopy[locale].title}>
      <h2 className="flex items-center gap-2 text-base font-black text-slate-950"><TimerReset size={18} aria-hidden="true" />{timeCopy[locale].title}</h2>
      <p className={`mt-3 rounded-md px-3 py-2 text-sm font-black ring-1 ${toneClass}`}>{primary.text}</p>
      {state.recommendedAtArrival === true ? <p className="mt-3 text-sm font-black text-emerald-800">{timeCopy[locale].recommended}</p> : null}
      {notices.length ? (
        <ul className="mt-3 space-y-2 text-sm font-bold leading-5 text-slate-700">
          {notices.map((notice) => (
            <li key={notice} className="flex items-start gap-2">
              {state.photoTimeAtArrival && notice === notices.find((item) => item.includes(timeCopy[locale].photoKeyword)) ? <Camera size={15} className="mt-0.5 shrink-0 text-teal-700" aria-hidden="true" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />}
              <span>{notice}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-slate-500">{timeCopy[locale].basis}</p>
    </section>
  );
}

const timeCopy: Record<Locale, { title: string; recommended: string; basis: string; photoKeyword: string }> = {
  ko: { title: "도착 시간 기준 영업 판단", recommended: "지금 출발하기 좋은 시간입니다.", basis: "Asia/Seoul 기준 · 관리자 검수 시간 데이터만 사용", photoKeyword: "사진" },
  zh: { title: "按到达时间判断", recommended: "现在出发属于推荐时段。", basis: "以 Asia/Seoul 为准 · 仅使用管理员审核的时间数据", photoKeyword: "拍照" },
  en: { title: "Status at estimated arrival", recommended: "This is a recommended time to leave.", basis: "Asia/Seoul · Uses reviewed structured time data only", photoKeyword: "photo" },
  ja: { title: "到着時間基準の営業判断", recommended: "今出発するのにおすすめの時間です。", basis: "Asia/Seoul基準 · 管理者確認済みの時間データのみ使用", photoKeyword: "写真" },
};
