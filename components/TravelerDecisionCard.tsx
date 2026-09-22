import { AlertTriangle, BadgeCheck, Check, CircleHelp, Gauge, ShieldCheck, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  getDecisionCopy,
  getDecisionEvidence,
  getDecisionStatus,
  getDecisionStatusLabel,
  getDecisionWarnings,
  getLocalizedDecisionText,
  getPracticalFacts,
  getThemeLabels,
  getWorthLabel,
} from "@/lib/traveler-decision-display";
import type { PlaceFactTristate, PlaceWithRelations } from "@/types/database";
import { getForeignerDifficultyDimensions, getLargestKnownObstacle } from "@/lib/traveler-practical-display";

type TravelerDecisionCardProps = {
  place: PlaceWithRelations;
  locale: Locale;
  variant?: "compact" | "detail";
  className?: string;
};

export function TravelerDecisionCard({ place, locale, variant = "compact", className = "" }: TravelerDecisionCardProps) {
  const text = getDecisionCopy(locale);
  const status = getDecisionStatus(place);
  const recommended = getThemeLabels(place.decision_profile?.recommended_for, locale, variant === "compact" ? 2 : 12);
  const notRecommended = getThemeLabels(place.decision_profile?.not_recommended_for, locale);
  const warnings = getDecisionWarnings(place, locale);
  const evidence = getDecisionEvidence(place, locale);
  const summary = getLocalizedDecisionText(place.decision_profile?.visit_summary, locale);
  const obstacle = getLargestKnownObstacle(place, locale);

  if (variant === "compact") {
    return (
      <section className={`space-y-2 ${className}`} aria-label={text.title}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-teal-50 px-2.5 text-teal-900 ring-1 ring-teal-100">
            <Gauge size={14} aria-hidden="true" />
            {text.worth}: {getWorthLabel(place, locale)}
          </span>
          <StatusBadge status={status} label={getDecisionStatusLabel(status, locale)} />
        </div>
        {recommended.length ? (
          <p className="line-clamp-1 text-xs font-bold text-slate-700">
            <span className="text-slate-500">{text.recommend}</span> · {recommended.join(" · ")}
          </p>
        ) : null}
        {warnings[0] ? (
          <p className="flex items-start gap-1.5 text-xs font-bold leading-5 text-amber-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{warnings[0]}</span>
          </p>
        ) : null}
        {obstacle ? <p className="flex items-start gap-1.5 text-xs font-bold leading-5 text-rose-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{obstacle.label}: {obstacle.value}</p> : null}
      </section>
    );
  }

  const practicalFacts = getPracticalFacts(place, locale);
  const difficultyItems = getForeignerDifficultyDimensions(place, locale);

  return (
    <section className={`bg-white px-5 py-6 ring-1 ring-slate-200 ${className}`} aria-labelledby={`decision-${place.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-teal-700">{text.title}</p>
          <h2 id={`decision-${place.id}`} className="mt-1 text-xl font-black text-slate-950">
            {text.worth}: {getWorthLabel(place, locale)}
          </h2>
        </div>
        <StatusBadge status={status} label={getDecisionStatusLabel(status, locale)} />
      </div>

      {summary ? <p className="mt-3 text-sm leading-6 text-slate-700">{summary}</p> : null}

      {(recommended.length || notRecommended.length) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ThemeGroup label={text.recommend} values={recommended} tone="positive" />
          <ThemeGroup label={text.notRecommend} values={notRecommended} tone="neutral" />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={text.difficulty}>
        {difficultyItems.map((item) => (
          <div key={item.key} className="min-w-0 rounded-md bg-slate-50 px-2 py-3 text-center ring-1 ring-slate-100">
            <p className="text-xs font-bold text-slate-500">{item.label}</p>
            <p className="mt-1 break-words text-sm font-black text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      {warnings.length ? (
        <div className="mt-5 rounded-md bg-amber-50 p-4 ring-1 ring-amber-200">
          <h3 className="flex items-center gap-2 text-sm font-black text-amber-950">
            <AlertTriangle size={16} aria-hidden="true" /> {text.warning}
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm font-bold leading-5 text-amber-950">
            {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
        </div>
      ) : null}

      <details className="mt-5 border-t border-slate-200 pt-4" open>
        <summary className="min-h-11 cursor-pointer list-none text-base font-black text-slate-950">{text.practical}</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {practicalFacts.map(({ key, ...fact }) => <PracticalFactRow key={key} {...fact} />)}
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-200 pt-4 text-xs font-bold text-slate-600">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} aria-hidden="true" />{getDecisionStatusLabel(status, locale)}</span>
        {evidence.length ? evidence.map((item) => <span key={item}>{item}</span>) : <span>{text.evidence}: {text.unknown}</span>}
      </div>
    </section>
  );
}

function StatusBadge({ status, label }: { status: ReturnType<typeof getDecisionStatus>; label: string }) {
  const className = status === "verified"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : status === "stale" || status === "conflicting"
      ? "bg-amber-50 text-amber-900 ring-amber-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  const Icon = status === "verified" ? BadgeCheck : status === "stale" || status === "conflicting" ? AlertTriangle : CircleHelp;
  return <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-black ring-1 ${className}`}><Icon size={14} aria-hidden="true" />{label}</span>;
}

function ThemeGroup({ label, values, tone }: { label: string; values: string[]; tone: "positive" | "neutral" }) {
  if (!values.length) return null;
  return (
    <div>
      <p className="text-xs font-black text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((value) => <span key={value} className={`rounded-md px-2.5 py-1.5 text-xs font-black ring-1 ${tone === "positive" ? "bg-teal-50 text-teal-900 ring-teal-100" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>{value}</span>)}
      </div>
    </div>
  );
}

function PracticalFactRow({ label, value, status }: { label: string; value: string; status: PlaceFactTristate }) {
  const Icon = status === "yes" ? Check : status === "no" ? X : CircleHelp;
  const iconClass = status === "yes" ? "text-emerald-700" : status === "no" ? "text-rose-700" : "text-slate-500";
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="inline-flex min-w-0 items-center justify-end gap-1.5 text-right text-sm font-black text-slate-950">
        <Icon size={15} className={`shrink-0 ${iconClass}`} aria-hidden="true" />
        <span className="break-words">{value}</span>
      </span>
    </div>
  );
}
