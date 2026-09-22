import Link from "next/link";
import { guideContent, guideCopy } from "@/lib/guide-copy";
import { type Locale, withLocale } from "@/lib/i18n";
import type { Guide } from "@/types/guide";
import { getThemeLabels } from "@/lib/traveler-decision-display";

export function GuideCard({ guide, locale }: { guide: Guide; locale: Locale }) {
  const content = guideContent(guide, locale);
  const copy = guideCopy[locale];
  const themes = getThemeLabels(guide.trip_themes, locale, 2);
  return <article className="min-w-0 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
    <Link href={withLocale(`/guides/${guide.slug}`, locale)} className="block">
      {guide.cover_image ? <img src={guide.cover_image} alt={content.title} loading="lazy" className="aspect-video w-full object-cover" /> : null}
      <div className="space-y-2 p-4">
        <p className="text-xs font-bold text-teal-700">{copy.official} · {copy.types[guide.guide_type]}{guide.is_featured ? ` · ${copy.featured}` : ""}</p>
        <h2 className="break-words text-lg font-black text-slate-950">{content.title}</h2>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{content.description}</p>
        <p className="text-sm text-slate-500">{guide.area}{guide.estimated_duration !== null ? ` · ${guide.estimated_duration} ${copy.minutes}` : ""}</p>
        {guide.recommended_for[locale] ? <p className="line-clamp-2 text-sm font-bold text-slate-700">{guide.recommended_for[locale]}</p> : null}
        {themes.length ? <div className="flex flex-wrap gap-1.5">{themes.map((theme) => <span key={theme} className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800">{theme}</span>)}</div> : null}
        {guide.recommended_start_time ? <p className="text-xs font-bold text-slate-500">{startCopy[locale]} {guide.recommended_start_time.slice(0, 5)}</p> : null}
      </div>
    </Link>
  </article>;
}

const startCopy = { ko: "추천 시작", zh: "建议开始", en: "Start", ja: "おすすめ開始" };
