"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { validateLocaleText } from "@/lib/place-ai/locale-validation";
import type { PlaceAiGeneratedContent, PlaceAiGenerationResponse, PlaceContentLocale } from "@/types/place-ai";

export type AdminAiDraftApplyField =
  | "description_ko" | "description_zh" | "description_en" | "description_ja"
  | "travel_tip_ko" | "travel_tip_zh" | "travel_tip_en" | "travel_tip_ja";

type AdminAiDraftPanelProps = {
  draft: PlaceAiGenerationResponse | null;
  generating: boolean;
  canApply: boolean;
  currentContent: Record<AdminAiDraftApplyField, string>;
  onGenerate: (locales?: PlaceContentLocale[]) => void;
  onApply: (fields: AdminAiDraftApplyField[]) => void;
  onCancel: () => void;
};

const applyFields: Array<{ key: AdminAiDraftApplyField; label: string; localeLabel: string; locale: PlaceContentLocale; field: "description" | "travel_tip" }> = [
  { key: "description_ko", label: "한국어 설명", localeLabel: "ko · description", locale: "ko", field: "description" },
  { key: "travel_tip_ko", label: "한국어 여행 팁", localeLabel: "ko · travel_tip", locale: "ko", field: "travel_tip" },
  { key: "description_zh", label: "中文说明", localeLabel: "zh · description", locale: "zh", field: "description" },
  { key: "travel_tip_zh", label: "中文旅行提示", localeLabel: "zh · travel_tip", locale: "zh", field: "travel_tip" },
  { key: "description_en", label: "English description", localeLabel: "en · description", locale: "en", field: "description" },
  { key: "travel_tip_en", label: "English travel tip", localeLabel: "en · travel_tip", locale: "en", field: "travel_tip" },
  { key: "description_ja", label: "日本語の説明", localeLabel: "ja · description", locale: "ja", field: "description" },
  { key: "travel_tip_ja", label: "日本語の旅行ヒント", localeLabel: "ja · travel_tip", locale: "ja", field: "travel_tip" },
];

export function AdminAiDraftPanel({
  draft,
  generating,
  canApply,
  currentContent,
  onGenerate,
  onApply,
  onCancel,
}: AdminAiDraftPanelProps) {
  const content = draft?.generated_content ?? null;
  const validation = useMemo(() => validateGeneratedContent(content, draft), [content, draft]);
  const failedLocales = useMemo(
    () => (["ko", "zh", "en", "ja"] as const).filter((locale) => {
      const status = draft?.locale_results?.[locale]?.status;
      return status === "failed" || status === "partial";
    }),
    [draft],
  );
  const [selectedFields, setSelectedFields] = useState<AdminAiDraftApplyField[]>([]);

  useEffect(() => {
    if (!content) {
      setSelectedFields([]);
      return;
    }

    setSelectedFields(
      applyFields
        .filter((field) => content[field.key].trim() && !currentContent[field.key].trim() && validation[field.key].valid)
        .map((field) => field.key),
    );
  }, [content, currentContent, validation]);

  const applyableFields = applyFields.filter((field) => content?.[field.key].trim() && validation[field.key].valid);
  const hasInvalidFields = applyFields.some((field) => content?.[field.key].trim() && !validation[field.key].valid);

  function toggleField(field: AdminAiDraftApplyField) {
    setSelectedFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  return (
    <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-950">AI 생성 결과 미리보기</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            AI 초안은 자동 저장/공개되지 않습니다. 체크한 설명 필드만 현재 폼에 복사되고, 최종 저장은 관리자가 직접 해야 합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onGenerate()}
            disabled={generating}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-indigo-50 px-4 text-xs font-black text-indigo-800 ring-1 ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
            {generating ? "생성 중" : draft ? "다시 생성" : "AI 여행정보 생성"}
          </button>
          {draft && failedLocales.length > 0 ? (
            <button
              type="button"
              onClick={() => onGenerate(failedLocales)}
              disabled={generating}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-50 px-4 text-xs font-black text-amber-800 ring-1 ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} aria-hidden="true" />
              실패 언어 다시 생성
            </button>
          ) : null}
          {draft ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={generating}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-slate-700 ring-1 ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={15} aria-hidden="true" />
              취소
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onApply(selectedFields)}
            disabled={!canApply || generating || selectedFields.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={15} aria-hidden="true" />
            현재 폼에 적용
          </button>
        </div>
      </div>

      {generating ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-indigo-800 ring-1 ring-indigo-100">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          여행자용 설명 생성 중...
        </div>
      ) : null}

      {draft && content ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <p>{draft.message}</p>
            <p className="mt-1 text-slate-400">
              {draft.generated_at ? `생성: ${new Date(draft.generated_at).toLocaleString("ko-KR")}` : null}
              {draft.model ? ` · 모델: ${draft.model}` : null}
              {draft.content_version ? ` · 버전: ${draft.content_version}` : null}
            </p>
          </div>

          {hasInvalidFields ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
              일부 언어 필드에서 언어 혼합 가능성이 감지되어 해당 필드는 적용할 수 없습니다. 다시 생성하거나 직접 수정해 주세요.
            </p>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {applyFields.map((field) => (
              <DraftTextField
                key={field.key}
                label={field.label}
                localeLabel={field.localeLabel}
                value={content[field.key]}
                currentValue={currentContent[field.key]}
                selected={selectedFields.includes(field.key)}
                valid={validation[field.key].valid}
                warning={validation[field.key].warning}
                onToggle={() => toggleField(field.key)}
              />
            ))}
          </div>

          <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 ring-1 ring-teal-100">
            적용 가능 필드 {applyableFields.length}개 중 {selectedFields.length}개 선택됨. 가격, 주소, 좌표, 영업시간, 메뉴 가격, 지도 링크는 AI가 변경하지 않습니다.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          지도 링크와 장소명, 대표 메뉴나 주소 같은 최소 정보를 입력한 뒤 생성 버튼을 누르면 이 영역에서 결과를 검토합니다.
        </p>
      )}
    </section>
  );
}

function DraftTextField({
  label,
  localeLabel,
  value,
  currentValue,
  selected,
  valid,
  warning,
  onToggle,
}: {
  label: string;
  localeLabel: string;
  value: string;
  currentValue: string;
  selected: boolean;
  valid: boolean;
  warning: string;
  onToggle: () => void;
}) {
  const hasGeneratedValue = Boolean(value.trim());
  const hasCurrentValue = Boolean(currentValue.trim());
  const disabled = !hasGeneratedValue || !valid;

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-500">{label}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">{localeLabel}</p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-xs font-black text-slate-700">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            disabled={disabled}
            className="size-4 accent-teal-700 disabled:opacity-40"
          />
          적용
        </label>
      </div>
      <p className="mt-3 min-h-24 whitespace-pre-wrap break-words rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
        {value.trim() || "생성 결과 없음"}
      </p>
      {hasCurrentValue ? (
        <p className="mt-2 text-xs font-semibold text-amber-700">기존 값 있음. 체크한 경우에만 AI 결과로 교체됩니다.</p>
      ) : (
        <p className="mt-2 text-xs font-semibold text-teal-700">현재 빈 필드라 기본 적용 대상으로 선택됩니다.</p>
      )}
      {!valid ? <p className="mt-2 text-xs font-bold text-rose-700">{warning}</p> : null}
    </div>
  );
}

function validateGeneratedContent(content: PlaceAiGeneratedContent | null, draft: PlaceAiGenerationResponse | null) {
  return Object.fromEntries(applyFields.map((field) => {
    const localValidation = validateLocaleText(content?.[field.key] ?? "", field.locale);
    const failedByServer = draft?.locale_results?.[field.locale]?.failed_fields.includes(field.field) ?? false;
    return [field.key, failedByServer ? { valid: false, warning: draft?.locale_results?.[field.locale]?.message ?? localValidation.warning } : localValidation];
  })) as Record<AdminAiDraftApplyField, ReturnType<typeof validateLocaleText>>;
}
