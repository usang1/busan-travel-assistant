"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import {
  isItemSaved,
  savedItemsChangeEvent,
  toggleSavedItem,
} from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import { guideCopy } from "@/lib/guide-copy";
import { type Locale } from "@/lib/i18n";

type GuideSaveButtonProps = {
  guideId: string;
  guideType: string;
  slug: string;
  locale: Locale;
  titleKo: string;
  titleZh: string;
  imageUrl: string;
  meta: string;
  area: string;
};

export function GuideSaveButton({ guideId, guideType, slug, locale, titleKo, titleZh, imageUrl, meta, area }: GuideSaveButtonProps) {
  const { user, loading } = useAuth();
  const copy = guideCopy[locale];
  if (loading) return <span className="text-sm text-slate-500">{copy.loading}</span>;
  if (!user) return <GuestGuideSave guideId={guideId} guideType={guideType} slug={slug} locale={locale} titleKo={titleKo} titleZh={titleZh} imageUrl={imageUrl} meta={meta} area={area} />;
  return <AccountGuideSave key={`${user.id}:${guideId}`} guideId={guideId} guideType={guideType} area={area} userId={user.id} locale={locale} />;
}

function GuestGuideSave({ guideId, guideType, slug, locale, titleKo, titleZh, imageUrl, meta, area }: GuideSaveButtonProps) {
  const copy = guideCopy[locale];
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function load() {
      setSaved(isItemSaved({ id: guideId, type: "guide" }));
    }

    load();
    window.addEventListener(savedItemsChangeEvent, load);
    window.addEventListener("storage", load);

    return () => {
      window.removeEventListener(savedItemsChangeEvent, load);
      window.removeEventListener("storage", load);
    };
  }, [guideId]);

  function toggle() {
    const result = toggleSavedItem({
      id: guideId,
      type: "guide",
      titleKo,
      titleZh,
      href: `/${locale}/guides/${slug}`,
      imageUrl,
      meta,
    });
    setSaved(result.saved);
    void recordPlaceEvent({
      eventType: result.saved ? "guide_save" : "guide_unsave",
      locale,
      metadata: { guide_id: guideId, guide_type: guideType, area, source: "guide_save_button" },
    });
    window.dispatchEvent(new Event("guide-save-change"));
  }

  return <button type="button" aria-pressed={saved} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-bold text-white transition active:scale-95" onClick={toggle}><Heart size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{saved ? copy.saved : copy.save}</button>;
}

function AccountGuideSave({ guideId, guideType, area, userId, locale }: { guideId: string; guideType: string; area: string; userId: string; locale: Locale }) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const copy = guideCopy[locale];
  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();
    async function load() {
      try {
        if (!client) throw new Error();
        const { data, error } = await client.from("guide_saves").select("guide_id").eq("guide_id", guideId).eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (active) { setSaved(Boolean(data)); setReady(true); setError(false); }
      } catch { if (active) setError(true); }
    }
    void load();
    window.addEventListener("guide-save-change", load);
    return () => {
      active = false;
      window.removeEventListener("guide-save-change", load);
    };
  }, [guideId, userId, attempt]);
  async function toggle() {
    if (busy || !ready) return;
    const client = getSupabaseClient();
    if (!client) { setError(true); return; }
    setBusy(true); setError(false);
    try {
      const result = saved
        ? await client.from("guide_saves").delete().eq("guide_id", guideId).eq("user_id", userId)
        : await client.from("guide_saves").insert({ guide_id: guideId, user_id: userId });
      if (result.error && !(result.error.code === "23505" && !saved)) throw result.error;
      setSaved(!saved);
      void recordPlaceEvent({
        eventType: saved ? "guide_unsave" : "guide_save",
        locale,
        userId,
        metadata: { guide_id: guideId, guide_type: guideType, area, source: "guide_save_button" },
      });
      window.dispatchEvent(new Event("guide-save-change"));
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <button type="button" disabled={busy || (!ready && !error)} aria-pressed={saved} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50" onClick={() => ready ? void toggle() : setAttempt((n) => n + 1)}><Heart size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{saved ? copy.saved : copy.save}</button>
    {error ? <p role="alert" className="max-w-sm text-sm text-rose-700">{copy.error}</p> : null}
  </div>;
}
