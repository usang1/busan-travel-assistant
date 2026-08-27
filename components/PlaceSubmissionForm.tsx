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
import { categoryLabels, placeCategories, type PlaceCategory } from "@/types/database";
import { defaultLocale, getLocaleFromPath, type Locale, ui, withLocale } from "@/lib/i18n";

type PlaceSubmissionFormProps = {
  locale?: Locale;
};

export function PlaceSubmissionForm({ locale = defaultLocale }: PlaceSubmissionFormProps) {
  const pathname = usePathname();
  const currentLocale = getLocaleFromPath(pathname) ?? locale;
  const copy = ui[currentLocale];
  const { user, loading } = useAuth();
  const [mapUrl, setMapUrl] = useState("");
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "">("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
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

    const notes = [
      reason.trim(),
      description.trim() ? `${copy.submissions.descriptionLabel}: ${description.trim()}` : "",
      imageUrl.trim() ? `${copy.submissions.imageUrl}: ${imageUrl.trim()}` : "",
      extraNotes.trim() ? `${copy.submissions.notes}: ${extraNotes.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    const { error } = await client.from("place_submissions").insert({
      user_id: user.id,
      locale: currentLocale,
      name: name.trim() || null,
      category: category || null,
      provider: parsed.provider,
      source_url: parsed.normalizedUrl || null,
      address_text: locationText.trim() || null,
      location_text: locationText.trim() || null,
      recommendation_reason: reason.trim(),
      notes: notes || reason.trim() || name.trim() || parsed.normalizedUrl,
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
    setCategory("");
    setDescription("");
    setLocationText("");
    setImageUrl("");
    setExtraNotes("");
    setStatus(copy.submissions.submitted);
  }

  if (loading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{copy.common.loading}</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title={copy.submissions.title} description={copy.submissions.loginDescription} locale={currentLocale} />;
  }

  return (
    <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">{copy.submissions.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{copy.submissions.description}</p>
        </div>
        <Link href={withLocale("/submissions", currentLocale)} className="shrink-0 text-sm font-black text-teal-700">
          {copy.submissions.myTitle}
        </Link>
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{copy.submissions.mapUrl}</span>
          <input
            type="url"
            value={mapUrl}
            onChange={(event) => setMapUrl(event.target.value)}
            placeholder="Naver / Kakao / Google Maps URL"
            className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>

        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          <ExternalLink size={14} aria-hidden="true" />
          Provider: {parsed.provider}
        </div>

        <label className="block">
          <span className="text-sm font-bold text-slate-700">{copy.submissions.reason}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            rows={4}
            placeholder={copy.submissions.reason}
            className="mt-2 w-full rounded-2xl bg-slate-50 px-3 py-3 text-base outline-none ring-1 ring-slate-200"
          />
        </label>

        <details className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <summary className="cursor-pointer text-sm font-black text-slate-700">{copy.submissions.optional}</summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">{copy.submissions.name}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl bg-white px-3 text-base outline-none ring-1 ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">{copy.submissions.category}</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as PlaceCategory | "")}
                className="mt-2 h-11 w-full rounded-2xl bg-white px-3 text-base outline-none ring-1 ring-slate-200"
              >
                <option value="">{copy.common.noInfo}</option>
                {placeCategories.map((item) => (
                  <option key={item} value={item}>{categoryLabels[item][currentLocale]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">{copy.submissions.address}</span>
              <input
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                placeholder={copy.submissions.address}
                className="mt-2 h-11 w-full rounded-2xl bg-white px-3 text-base outline-none ring-1 ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">{copy.submissions.descriptionLabel}</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-2xl bg-white px-3 py-3 text-base outline-none ring-1 ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">{copy.submissions.imageUrl}</span>
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
                className="mt-2 h-11 w-full rounded-2xl bg-white px-3 text-base outline-none ring-1 ring-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">{copy.submissions.notes}</span>
              <textarea
                value={extraNotes}
                onChange={(event) => setExtraNotes(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-2xl bg-white px-3 py-3 text-base outline-none ring-1 ring-slate-200"
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
          {copy.submissions.submit}
        </button>
      </form>

      {status ? <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{status}</p> : null}
    </section>
  );
}
