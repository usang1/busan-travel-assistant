"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GuideCard } from "@/components/GuideCard";
import { guideContent, guideCopy } from "@/lib/guide-copy";
import type { Locale } from "@/lib/i18n";
import { guideTypes, type Guide, type GuideType } from "@/types/guide";

export function GuideExplorer({ guides, locale }: { guides: Guide[]; locale: Locale }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<GuideType | "all" | "featured">("all");
  const [query, setQuery] = useState(() => searchParams.get("search") ?? searchParams.get("q") ?? "");
  const [area, setArea] = useState("");
  const copy = guideCopy[locale];
  const areas = [...new Set(guides.map((guide) => guide.area).filter(Boolean))];
  const visible = guides.filter((guide) => {
    const content = guideContent(guide, locale);
    return (tab === "all" || (tab === "featured" ? guide.is_featured : guide.guide_type === tab))
      && (!area || guide.area === area)
      && `${content.title} ${content.description} ${guide.area} ${guide.recommended_for[locale] ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2" aria-label={copy.title}>
      {(["all", "featured", ...guideTypes] as const).map((value) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${tab === value ? "bg-teal-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{value === "all" ? copy.all : value === "featured" ? copy.featured : copy.types[value]}</button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
      <label className="min-w-0 text-sm font-bold text-slate-700">{copy.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3" /></label>
      <label className="min-w-0 text-sm font-bold text-slate-700">{copy.area}<select value={area} onChange={(event) => setArea(event.target.value)} className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3"><option value="">{copy.all}</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
    </div>
    {visible.length ? <div className="grid min-w-0 gap-4 sm:grid-cols-2">{visible.map((guide) => <GuideCard key={guide.id} guide={guide} locale={locale} />)}</div> : <p role="status" className="rounded-2xl bg-white p-6 text-sm text-slate-500">{copy.empty}</p>}
  </div>;
}
