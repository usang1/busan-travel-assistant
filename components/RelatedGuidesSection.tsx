import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GuideCard } from "@/components/GuideCard";
import { guideCopy } from "@/lib/guide-copy";
import { type Locale, withLocale } from "@/lib/i18n";
import type { Guide } from "@/types/guide";

const titles: Record<Locale, string> = {
  zh: "继续看相关路线",
  en: "Related guides",
  ja: "関連ガイド",
  ko: "관련 공식 가이드",
};

export function RelatedGuidesSection({ guides, locale }: { guides: Guide[]; locale: Locale }) {
  const copy = guideCopy[locale];

  if (!guides.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-950">{titles[locale]}</h2>
        <Link href={withLocale("/guides", locale)} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-teal-700">
          {copy.all}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {guides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} locale={locale} />
        ))}
      </div>
    </section>
  );
}
