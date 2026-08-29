"use client";

import { Check, Sparkles } from "lucide-react";
import type { PlaceAiGenerationResponse } from "@/types/place-ai";

type AdminAiDraftPanelProps = {
  draft: PlaceAiGenerationResponse | null;
  generating: boolean;
  canApply: boolean;
  onGenerate: () => void;
  onApply: () => void;
};

export function AdminAiDraftPanel({ draft, generating, canApply, onGenerate, onApply }: AdminAiDraftPanelProps) {
  const content = draft?.generated_content ?? null;

  return (
    <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-950">AI 생성 결과 검토</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            이번 단계에서는 외부 AI API를 호출하지 않고, 생성 결과를 검토 후 적용하는 흐름만 준비합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-indigo-50 px-4 text-xs font-black text-indigo-800 ring-1 ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles size={15} aria-hidden="true" />
            {generating ? "준비 중" : draft ? "다시 생성" : "AI 여행정보 생성"}
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!canApply || generating}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={15} aria-hidden="true" />
            적용
          </button>
        </div>
      </div>

      {draft ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{draft.message}</p>
          <DraftField label="한국어 설명" value={content?.description_ko} />
          <DraftField label="중국어 설명" value={content?.description_zh} />
          <DraftField label="영어 설명" value={content?.description_en} />
          <DraftField label="일본어 설명" value={content?.description_ja} />
          <DraftField label="한줄 요약" value={content?.short_summary} />
          <DraftList label="추천 포인트" values={content?.highlights} />
          <DraftList label="여행자 TIP" values={content?.traveler_tips} />
          <DraftList label="추천 대상" values={content?.recommended_for} />
          <DraftList label="주의사항" values={content?.cautions} />
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-500">지도 링크와 장소 기본 정보를 입력한 뒤 생성 버튼을 누르면 이 영역에서 결과를 검토합니다.</p>
      )}
    </section>
  );
}

function DraftField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 min-h-9 rounded-xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200">{value?.trim() || "생성 결과 없음"}</p>
    </div>
  );
}

function DraftList({ label, values }: { label: string; values?: string[] }) {
  const items = values?.filter((value) => value.trim()) ?? [];

  return (
    <div>
      <p className="text-xs font-black text-slate-500">{label}</p>
      <div className="mt-1 flex min-h-9 flex-wrap gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
        {items.length ? items.map((value) => <span key={value} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{value}</span>) : <span className="text-sm text-slate-400">생성 결과 없음</span>}
      </div>
    </div>
  );
}
