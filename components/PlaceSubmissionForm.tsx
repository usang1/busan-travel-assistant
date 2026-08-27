"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { parseMapUrl } from "@/lib/map-url";
import { recordPlaceEvent } from "@/lib/place-events";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, type Locale, withLocale } from "@/lib/i18n";

type PlaceSubmissionFormProps = {
  locale?: Locale;
};

export function PlaceSubmissionForm({ locale = defaultLocale }: PlaceSubmissionFormProps) {
  const pathname = usePathname();
  const currentLocale = getLocaleFromPath(pathname) ?? locale;
  const { user, loading } = useAuth();
  const [mapUrl, setMapUrl] = useState("");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const parsed = useMemo(() => parseMapUrl(mapUrl), [mapUrl]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();

    if (!client || !user) {
      return;
    }

    setSubmitting(true);
    setStatus("");

    const { error } = await client.from("place_submissions").insert({
      user_id: user.id,
      locale: currentLocale,
      name: name.trim() || null,
      provider: parsed.provider,
      source_url: parsed.normalizedUrl,
      location_text: locationText.trim() || null,
      recommendation_reason: reason.trim(),
      notes: reason.trim(),
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    await recordPlaceEvent({
      eventType: "submission_created",
      locale: currentLocale,
      userId: user.id,
      metadata: { provider: parsed.provider },
    });

    setMapUrl("");
    setReason("");
    setName("");
    setLocationText("");
    setStatus("제보가 접수되었습니다. 내 제보에서 검수 상태를 확인할 수 있습니다.");
  }

  if (loading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Loading...</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title="장소 제보" description="장소 제보는 로그인 후 접수할 수 있습니다." locale={currentLocale} />;
  }

  return (
    <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">장소 제보</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">지도 링크와 추천 이유만 보내면 관리자가 검수 후 장소 정보를 완성합니다.</p>
        </div>
        <Link href={withLocale("/submissions", currentLocale)} className="shrink-0 text-sm font-black text-teal-700">
          내 제보
        </Link>
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">장소 지도 링크</span>
          <input
            type="url"
            value={mapUrl}
            onChange={(event) => setMapUrl(event.target.value)}
            required
            placeholder="Naver / Kakao / Google Maps URL"
            className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>

        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          <ExternalLink size={14} aria-hidden="true" />
          Provider: {parsed.provider}
        </div>

        <label className="block">
          <span className="text-sm font-bold text-slate-700">추천 이유</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={4}
            placeholder="왜 여행자에게 추천하고 싶은지 알려주세요."
            className="mt-2 w-full rounded-2xl bg-slate-50 px-3 py-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>

        <details className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-black text-slate-700">선택 입력</summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">장소명</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl bg-white px-3 text-base outline-none ring-1 ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">위치 힌트</span>
              <input
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                placeholder="예: 광안리 해변 근처"
                className="mt-2 h-11 w-full rounded-2xl bg-white px-3 text-base outline-none ring-1 ring-slate-200"
              />
            </label>
          </div>
        </details>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-60"
        >
          <Send size={17} aria-hidden="true" />
          접수
        </button>
      </form>

      {status ? <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{status}</p> : null}
    </section>
  );
}
