"use client";

import { CheckCircle2, CircleAlert, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import type { PlaceAutofillDiagnostics, PlaceAutofillField, PlaceAutofillFieldStatus } from "@/lib/place-autofill";

const statusCopy: Record<PlaceAutofillFieldStatus, { label: string; className: string }> = {
  auto_filled: { label: "자동입력 성공", className: "bg-teal-50 text-teal-800" },
  no_data: { label: "데이터 없음", className: "bg-slate-100 text-slate-700" },
  lookup_failed: { label: "조회 실패", className: "bg-rose-50 text-rose-800" },
  review_required: { label: "수동 확인 필요", className: "bg-amber-50 text-amber-800" },
  manual_preserved: { label: "기존 수동 입력값 유지", className: "bg-blue-50 text-blue-800" },
};

export function AdminAutofillResults({ diagnostics, busy, onRetry }: {
  diagnostics: PlaceAutofillDiagnostics | null;
  busy: boolean;
  onRetry: (fields: PlaceAutofillField[]) => void;
}) {
  if (!diagnostics) return null;
  const retryable = diagnostics.fieldResults.filter((field) => field.retryable && (field.status === "no_data" || field.status === "lookup_failed" || field.status === "review_required"));

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200" aria-labelledby="autofill-result-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id="autofill-result-title" className="text-sm font-black text-slate-950">필드별 자동입력 결과</h4>
          <p className="mt-1 text-xs text-slate-500">실행 {diagnostics.runId.slice(0, 8)} · {diagnostics.durationMs.toLocaleString()}ms · {diagnostics.provider.toUpperCase()}</p>
        </div>
        {retryable.length ? <button type="button" disabled={busy} onClick={() => onRetry(retryable.map((field) => field.field))} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-50"><RefreshCw size={14} />누락 항목 다시 조회</button> : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {diagnostics.fieldResults.map((field) => {
          const copy = statusCopy[field.status];
          const Icon = field.status === "auto_filled" ? CheckCircle2 : field.status === "manual_preserved" ? ShieldCheck : field.status === "lookup_failed" ? XCircle : CircleAlert;
          return <div key={field.field} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100"><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Icon size={15} className="shrink-0 text-slate-600" /><span className="truncate text-xs font-black text-slate-900">{field.label}</span></div>{field.retryable && field.status !== "auto_filled" && field.status !== "manual_preserved" ? <button type="button" disabled={busy} onClick={() => onRetry([field.field])} className="shrink-0 text-[11px] font-black text-teal-800 underline disabled:opacity-50">재조회</button> : null}</div><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${copy.className}`}>{copy.label}</span><p className="mt-1 truncate text-[10px] text-slate-400">출처 {field.source}</p></div>;
        })}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">데이터 없음은 제공자가 해당 값을 주지 않았다는 뜻입니다. 자동입력 결과는 저장 전 확인해야 하며, 기존 입력값은 재조회로 덮어쓰지 않습니다.</p>
    </section>
  );
}
