"use client";

import { AlertTriangle, BadgeCheck, CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { loadTravelerTrustSummary } from "@/lib/traveler-trust-client";
import { emptyTravelerTrustSummary, getTravelerCardTrustSignal, type TravelerTrustSummary } from "@/lib/traveler-verification";

export function TravelerTrustSummaryBadge({ placeId, locale }: { placeId: string; locale: Locale }) {
  const [summary, setSummary] = useState<TravelerTrustSummary>(emptyTravelerTrustSummary());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadTravelerTrustSummary(placeId)
      .then((nextSummary) => { if (active) setSummary(nextSummary); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [placeId]);

  const signal = loaded ? getTravelerCardTrustSignal(summary, locale) : { tone: "neutral" as const, text: loadingCopy[locale] };
  const Icon = signal.tone === "positive" ? BadgeCheck : signal.tone === "warning" ? AlertTriangle : CircleHelp;
  const classes = signal.tone === "positive"
    ? "bg-teal-50 text-teal-800 ring-teal-100"
    : signal.tone === "warning"
      ? "bg-amber-50 text-amber-900 ring-amber-100"
      : "bg-slate-50 text-slate-600 ring-slate-200";

  return (
    <p className={`mt-3 inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ring-1 ${classes}`}>
      <Icon size={15} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{signal.text}</span>
    </p>
  );
}

const loadingCopy = {
  ko: "현장 정보 확인 중",
  zh: "正在确认现场信息",
  en: "Checking field information",
  ja: "現地情報を確認中",
} satisfies Record<Locale, string>;
