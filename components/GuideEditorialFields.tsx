"use client";

import { Plus, Trash2 } from "lucide-react";
import type { GuideEditorial } from "@/types/guide";

const empty: GuideEditorial = { question: "", answer: "", not_recommended_for: "", tips: "", faq: [], sources: [], last_checked: "" };
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function GuideEditorialFields({ value, onChange }: { value?: GuideEditorial; onChange: (value: GuideEditorial) => void }) {
  const entry = value ?? empty;
  const update = (patch: Partial<GuideEditorial>) => onChange({ ...entry, ...patch });
  return <fieldset className="mt-4 min-w-0 space-y-3 border-t border-slate-200 pt-3">
    <legend className="font-bold">여행 질문과 답변</legend>
    {(["question", "answer", "not_recommended_for", "tips"] as const).map((field) => <label key={field} className="block text-sm">{{ question: "질문형 제목", answer: "짧은 직접 답변", not_recommended_for: "추천하지 않는 대상", tips: "실패 방지 팁" }[field]}<textarea className={inputClass} rows={field === "question" ? 1 : 3} maxLength={field === "question" ? 200 : field === "answer" ? 1000 : 4000} value={entry[field]} onChange={(event) => update({ [field]: event.target.value })} /></label>)}
    <label className="block text-sm">마지막 확인일<input className={inputClass} type="date" value={entry.last_checked} onChange={(event) => update({ last_checked: event.target.value })} /></label>
    <div className="space-y-2">
      {entry.faq.map((item, index) => <div key={index} className="space-y-2 border-b border-slate-200 pb-3">
        <label className="block text-sm">FAQ 질문 {index + 1}<input className={inputClass} maxLength={200} value={item.question} onChange={(event) => update({ faq: entry.faq.map((row, i) => i === index ? { ...row, question: event.target.value } : row) })} /></label>
        <label className="block text-sm">답변<textarea className={inputClass} maxLength={4000} value={item.answer} onChange={(event) => update({ faq: entry.faq.map((row, i) => i === index ? { ...row, answer: event.target.value } : row) })} /></label>
        <button type="button" aria-label={`FAQ ${index + 1} 삭제`} title="FAQ 삭제" className="inline-flex size-11 items-center justify-center" onClick={() => update({ faq: entry.faq.filter((_, i) => i !== index) })}><Trash2 size={18} /></button>
      </div>)}
      <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold" disabled={entry.faq.length >= 20} onClick={() => update({ faq: [...entry.faq, { question: "", answer: "" }] })}><Plus size={18} />FAQ 추가</button>
    </div>
    <div className="space-y-2">
      {entry.sources.map((item, index) => <div key={index} className="space-y-2 border-b border-slate-200 pb-3">
        <label className="block text-sm">출처 이름<input className={inputClass} maxLength={200} value={item.label} onChange={(event) => update({ sources: entry.sources.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })} /></label>
        <label className="block text-sm">출처 URL<input className={inputClass} type="url" maxLength={2048} value={item.url} onChange={(event) => update({ sources: entry.sources.map((row, i) => i === index ? { ...row, url: event.target.value } : row) })} /></label>
        <button type="button" aria-label={`출처 ${index + 1} 삭제`} title="출처 삭제" className="inline-flex size-11 items-center justify-center" onClick={() => update({ sources: entry.sources.filter((_, i) => i !== index) })}><Trash2 size={18} /></button>
      </div>)}
      <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold" disabled={entry.sources.length >= 20} onClick={() => update({ sources: [...entry.sources, { label: "", url: "" }] })}><Plus size={18} />출처 추가</button>
    </div>
  </fieldset>;
}
