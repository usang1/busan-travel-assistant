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

export function RelatedGuidesSection({ guides, locale, headingLevel = "h2" }: { guides: Guide[]; locale: Locale; headingLevel?: "h2" | "h3" }) {
  const copy = guideCopy[locale];
  const Heading = headingLevel;

  if (!guides.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <Heading className="text-xl font-black text-slate-950">{titles[locale]}</Heading>
        <Link href={withLocale("/guides", locale)} className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-teal-700">
          {copy.all}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {guides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} locale={locale} headingLevel="h3" />
        ))}
      </div>
    </section>
  );
}
