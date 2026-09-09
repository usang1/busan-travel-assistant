"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { GuideCard } from "@/components/GuideCard";
import { recordPlaceEvent } from "@/lib/place-events";
import { getPublishedGuidesByIds } from "@/lib/guide-store";
import {
  getSavedGuideIds,
  readSavedItems,
  removeSavedItem,
  savedItemsChangeEvent,
} from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import { guideCopy } from "@/lib/guide-copy";
import { withLocale, type Locale } from "@/lib/i18n";
import type { Guide } from "@/types/guide";

export function SavedGuides({ locale }: { locale: Locale }) {
  const { user, loading } = useAuth();
  const copy = guideCopy[locale];
  return <section className="mt-8 space-y-4">
    <h2 className="text-xl font-black text-slate-950">{copy.savedTitle}</h2>
    {loading ? <p>{copy.loading}</p> : user ? <AccountSavedGuides key={user.id} userId={user.id} locale={locale} /> : <GuestSavedGuides locale={locale} />}
  </section>;
}
function AccountSavedGuides({ userId, locale }: { userId: string; locale: Locale }) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [region, setRegion] = useState<SavedRegion>("all");
  const copy = guideCopy[locale];
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error();
        const { data, error } = await client.from("guide_saves").select("guides!inner(*)").eq("user_id", userId).eq("guides.status", "PUBLISHED").order("created_at", { ascending: false });
        if (error) throw error;
        const rows = data as unknown as { guides: Guide | Guide[] }[];
        if (active) { setGuides(rows.flatMap((row) => Array.isArray(row.guides) ? row.guides : [row.guides])); setState("ready"); }
      } catch { if (active) setState("error"); }
    }
    void load(); window.addEventListener("guide-save-change", load);
    return () => { active = false; window.removeEventListener("guide-save-change", load); };
  }, [userId]);
  async function removeGuide(guideId: string) {
    const client = getSupabaseClient();
    if (!client) return;
    const guide = guides.find((item) => item.id === guideId);
    const previous = guides;
    setGuides((current) => current.filter((guide) => guide.id !== guideId));
    const { error } = await client.from("guide_saves").delete().eq("user_id", userId).eq("guide_id", guideId);
    if (error) {
      setGuides(previous);
      return;
    }
    void recordPlaceEvent({
      eventType: "guide_unsave",
      locale,
      userId,
      metadata: { guide_id: guideId, guide_type: guide?.guide_type, area: guide?.area, source: "saved_list" },
    });
    window.dispatchEvent(new Event("guide-save-change"));
  }
  if (state !== "ready") return <p role="status" className="text-sm text-slate-500">{state === "error" ? copy.unavailable : copy.loading}</p>;
  return guides.length ? <GuideList guides={guides} locale={locale} region={region} onRegion={setRegion} onRemove={(guideId) => void removeGuide(guideId)} /> : <Link href={withLocale("/guides", locale)} className="inline-flex min-h-11 items-center text-sm font-bold text-teal-700">{copy.title} →</Link>;
}

function GuestSavedGuides({ locale }: { locale: Locale }) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [region, setRegion] = useState<SavedRegion>("all");
  const [state, setState] = useState<"loading" | "ready">("loading");
  const copy = guideCopy[locale];

  useEffect(() => {
    let active = true;

    async function load() {
      setState("loading");
      const ids = getSavedGuideIds();
      const stored = readSavedItems().filter((item) => item.type === "guide");
      const dbGuides = await getPublishedGuidesByIds(ids);
      const byId = new Map(dbGuides.map((guide) => [guide.id, guide]));
      const merged = stored.flatMap((item) => {
        const guide = byId.get(item.id);
        return guide ? [guide] : [];
      });

      if (active) {
        setGuides(merged);
        setState("ready");
      }
    }

    void load();
    window.addEventListener(savedItemsChangeEvent, load);
    window.addEventListener("guide-save-change", load);
    window.addEventListener("storage", load);

    return () => {
      active = false;
      window.removeEventListener(savedItemsChangeEvent, load);
      window.removeEventListener("guide-save-change", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  function removeGuide(guideId: string) {
    const guide = guides.find((item) => item.id === guideId);
    removeSavedItem({ id: guideId, type: "guide" });
    setGuides((current) => current.filter((guide) => guide.id !== guideId));
    void recordPlaceEvent({
      eventType: "guide_unsave",
      locale,
      metadata: { guide_id: guideId, guide_type: guide?.guide_type, area: guide?.area, source: "saved_list" },
    });
    window.dispatchEvent(new Event("guide-save-change"));
  }

  if (state !== "ready") return <p role="status" className="text-sm text-slate-500">{copy.loading}</p>;
  return guides.length ? <GuideList guides={guides} locale={locale} region={region} onRegion={setRegion} onRemove={removeGuide} /> : <Link href={withLocale("/guides", locale)} className="inline-flex min-h-11 items-center text-sm font-bold text-teal-700">{copy.title} →</Link>;
}

type SavedRegion = "all" | "gwangalli" | "haeundae" | "seomyeon" | "nampo" | "other";

const savedRegions: Array<{ value: SavedRegion; label: Record<Locale, string> }> = [
  { value: "all", label: { zh: "全部", en: "All", ja: "すべて", ko: "전체" } },
  { value: "gwangalli", label: { zh: "广安里", en: "Gwangalli", ja: "広安里", ko: "광안리" } },
  { value: "haeundae", label: { zh: "海云台", en: "Haeundae", ja: "海雲台", ko: "해운대" } },
  { value: "seomyeon", label: { zh: "西面", en: "Seomyeon", ja: "西面", ko: "서면" } },
  { value: "nampo", label: { zh: "南浦", en: "Nampo", ja: "南浦", ko: "남포" } },
  { value: "other", label: { zh: "其他", en: "Other", ja: "その他", ko: "기타" } },
];

function GuideList({ guides, locale, region, onRegion, onRemove }: { guides: Guide[]; locale: Locale; region: SavedRegion; onRegion: (region: SavedRegion) => void; onRemove: (guideId: string) => void }) {
  const copy = guideCopy[locale];
  const filteredGuides = region === "all" ? guides : guides.filter((guide) => getGuideRegion(guide) === region);

  return <div className="space-y-4">
    <div className="flex gap-2 overflow-x-auto pb-1">
      {savedRegions.map((item) => <button key={item.value} type="button" onClick={() => onRegion(item.value)} className={[
        "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
        region === item.value ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
      ].join(" ")}>{item.label[locale]}</button>)}
    </div>
    {filteredGuides.length ? <div className="grid gap-4 sm:grid-cols-2">{filteredGuides.map((guide) => <div key={guide.id} className="relative">
      <GuideCard guide={guide} locale={locale} />
      <button type="button" onClick={() => onRemove(guide.id)} className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl bg-white/95 text-rose-700 shadow-sm ring-1 ring-rose-100 transition active:scale-95" aria-label={copy.remove}>
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>)}</div> : <Link href={withLocale("/guides", locale)} className="inline-flex min-h-11 items-center text-sm font-bold text-teal-700">{copy.title} →</Link>}
  </div>;
}

function getGuideRegion(guide: Guide): SavedRegion {
  const text = `${guide.area} ${guide.title_ko} ${guide.title_zh}`.toLowerCase();
  if (text.includes("광안") || text.includes("广安")) return "gwangalli";
  if (text.includes("해운대") || text.includes("海云台") || text.includes("海雲台")) return "haeundae";
  if (text.includes("서면") || text.includes("西面")) return "seomyeon";
  if (text.includes("남포") || text.includes("南浦")) return "nampo";
  return "other";
}
