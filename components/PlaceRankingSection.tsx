"use client";

import { useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { PlaceCard } from "@/components/PlaceCard";
import type { Locale } from "@/lib/i18n";
import type { PlaceRankingCollection } from "@/types/database";

type RankingMode = "popular" | "trending";

const copy = {
  ko: { title: "지금 부산에서 많이 저장하는 곳", popular: "누적 저장", trending: "이번 주 급상승", empty: "저장 데이터가 쌓이면 인기 장소가 표시됩니다.", weekly: "최근 7일" },
  zh: { title: "现在釜山收藏较多的地点", popular: "累计收藏", trending: "本周上升", empty: "收藏数据积累后将在这里显示热门地点。", weekly: "最近7天" },
  en: { title: "Most saved in Busan now", popular: "All-time saves", trending: "Trending this week", empty: "Popular places will appear as save data grows.", weekly: "Last 7 days" },
  ja: { title: "今、釜山で保存されている場所", popular: "累計保存", trending: "今週の急上昇", empty: "保存データが増えると人気スポットが表示されます。", weekly: "直近7日" },
} satisfies Record<Locale, { title: string; popular: string; trending: string; empty: string; weekly: string }>;

export function PlaceRankingSection({ rankings, locale, title }: { rankings: PlaceRankingCollection; locale: Locale; title?: string }) {
  const [mode, setMode] = useState<RankingMode>("popular");
  const text = copy[locale];
  const places = rankings[mode];

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">{title ?? text.title}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{mode === "popular" ? text.popular : text.weekly}</p>
        </div>
        <div className="inline-flex rounded-2xl bg-slate-100 p-1">
          <RankingTab active={mode === "popular"} label={text.popular} icon={BarChart3} onClick={() => setMode("popular")} />
          <RankingTab active={mode === "trending"} label={text.trending} icon={TrendingUp} onClick={() => setMode("trending")} />
        </div>
      </div>

      {places.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <div key={place.id} className="relative">
              {mode === "trending" && (place.recent_save_count ?? 0) > 0 ? (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow-sm">
                  +{place.recent_save_count} {text.weekly}
                </span>
              ) : null}
              <PlaceCard place={place} locale={locale} compact />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">{text.empty}</p>
      )}
    </section>
  );
}

function RankingTab({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof BarChart3; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
