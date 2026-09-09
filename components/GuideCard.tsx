import Link from "next/link";
import { guideContent, guideCopy } from "@/lib/guide-copy";
import { type Locale, withLocale } from "@/lib/i18n";
import type { Guide } from "@/types/guide";

export function GuideCard({ guide, locale }: { guide: Guide; locale: Locale }) {
  const content = guideContent(guide, locale);
  const copy = guideCopy[locale];
  return <article className="min-w-0 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200">
    <Link href={withLocale(`/guides/${guide.slug}`, locale)} className="block">
      {guide.cover_image ? <img src={guide.cover_image} alt={content.title} loading="lazy" className="aspect-video w-full object-cover" /> : null}
      <div className="space-y-2 p-4">
        <p className="text-xs font-bold text-teal-700">{copy.official} · {copy.types[guide.guide_type]}{guide.is_featured ? ` · ${copy.featured}` : ""}</p>
        <h2 className="break-words text-lg font-black text-slate-950">{content.title}</h2>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{content.description}</p>
        <p className="text-sm text-slate-500">{guide.area}{guide.estimated_duration !== null ? ` · ${guide.estimated_duration} ${copy.minutes}` : ""}</p>
      </div>
    </Link>
  </article>;
}
