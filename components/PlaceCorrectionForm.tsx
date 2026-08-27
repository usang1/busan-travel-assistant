"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { getSupabaseClient } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

type PlaceCorrectionFormProps = {
  placeId: string;
  locale: Locale;
};

const fieldOptions = [
  { value: "opening_hours", label: "영업시간" },
  { value: "price", label: "가격" },
  { value: "address", label: "주소" },
  { value: "menu", label: "메뉴" },
  { value: "closed", label: "폐업" },
  { value: "other", label: "기타" },
];

export function PlaceCorrectionForm({ placeId, locale }: PlaceCorrectionFormProps) {
  const { user, loading } = useAuth();
  const [fieldName, setFieldName] = useState(fieldOptions[0].value);
  const [suggestedValue, setSuggestedValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();

    if (!client || !user) {
      return;
    }

    setSubmitting(true);
    setStatus("");

    const { error } = await client.from("place_corrections").insert({
      place_id: placeId,
      user_id: user.id,
      locale,
      field_name: fieldName,
      suggested_value: suggestedValue,
      source_url: sourceUrl || null,
      notes,
    });

    setSubmitting(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    await recordPlaceEvent({
      eventType: "correction_submitted",
      placeId,
      locale,
      userId: user.id,
      metadata: { field_name: fieldName },
    });

    setFieldName(fieldOptions[0].value);
    setSuggestedValue("");
    setSourceUrl("");
    setNotes("");
    setStatus("수정 요청이 접수되었습니다.");
  }

  if (loading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Loading...</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title="정보가 잘못되었나요?" description="장소 정보 수정 요청은 로그인 후 제출할 수 있습니다." locale={locale} />;
  }

  return (
    <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-black text-slate-950">정보가 잘못되었나요?</h2>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">수정할 정보</span>
          <select
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200"
          >
            {fieldOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">제안 내용</span>
          <textarea
            value={suggestedValue}
            onChange={(event) => setSuggestedValue(event.target.value)}
            required
            rows={4}
            className="mt-2 w-full rounded-2xl bg-slate-50 px-3 py-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">출처 URL</span>
          <input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">메모</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
        >
          <Send size={17} aria-hidden="true" />
          접수
        </button>
      </form>
      {status ? <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{status}</p> : null}
    </section>
  );
}
