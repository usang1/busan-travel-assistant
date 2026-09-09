"use client";

import { usePathname } from "next/navigation";
import { guideCopy } from "@/lib/guide-copy";
import { defaultLocale, getLocaleFromPath } from "@/lib/i18n";

export default function GuideError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = getLocaleFromPath(usePathname()) ?? defaultLocale;
  const copy = guideCopy[locale];
  return <main className="safe-bottom mx-auto max-w-3xl space-y-4 px-4 py-8">
    <h1 className="text-2xl font-black">{copy.title}</h1>
    <p role="alert" className="text-sm text-slate-600">{copy.unavailable}</p>
    <button type="button" onClick={reset} className="min-h-11 rounded-full bg-teal-700 px-4 text-sm font-bold text-white">{{ ko: "다시 시도", zh: "重试", en: "Try again", ja: "再試行" }[locale]}</button>
  </main>;
}
