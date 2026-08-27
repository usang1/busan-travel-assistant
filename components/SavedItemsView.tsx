"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogIn, Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { RecentPlacesView } from "@/components/RecentPlacesView";
import { SectionTitle } from "@/components/SectionTitle";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { getPlaceSaveCounts } from "@/lib/place-saves";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { categoryLabels, type PlaceCategory, type PlaceTranslationRecord, type PlaceWithRelations, type TagRecord } from "@/types/database";

type SavedPlace = {
  savedAt: string;
  place: PlaceWithRelations;
};

type SavedItemsViewProps = {
  locale?: Locale;
};

type SupabaseSavedPlaceRow = {
  created_at: string;
  places: SupabaseSavedPlacePayload | SupabaseSavedPlacePayload[] | null;
};

type SupabaseSavedPlacePayload = PlaceWithRelations & {
  place_translations?: PlaceTranslationRecord[] | null;
  place_tags?: Array<{ tags: TagRecord | null }> | null;
  place_menu_items?: PlaceWithRelations["menu_items"] | null;
};

const filters: Array<{ value: PlaceCategory | "all"; label: Record<Locale, string> }> = [
  { value: "all", label: { zh: "全部", en: "All", ja: "すべて", ko: "전체" } },
  { value: "restaurant", label: categoryLabels.restaurant },
  { value: "cafe", label: categoryLabels.cafe },
  { value: "attraction", label: { zh: "观光/景点", en: "Attractions", ja: "観光/名所", ko: "관광/명소" } },
  { value: "shopping", label: categoryLabels.shopping },
];

export function SavedItemsView({ locale }: SavedItemsViewProps) {
  const pathname = usePathname();
  const currentLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = ui[currentLocale];
  const { user, loading } = useAuth();
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSavedPlaces() {
      const client = getSupabaseClient();

      if (!client || !user) {
        setSavedPlaces([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await client
        .from("place_saves")
        .select("created_at, places(*, place_translations(*), place_tags(tags(*)), place_menu_items(*))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) {
        return;
      }

      if (error || !data) {
        setStatus(error?.message ?? "저장 목록을 불러오지 못했습니다.");
        setSavedPlaces([]);
        setIsLoading(false);
        return;
      }

      const places = (data as unknown as SupabaseSavedPlaceRow[])
        .map((row) => ({ ...row, places: Array.isArray(row.places) ? row.places[0] : row.places }))
        .filter((row): row is { created_at: string; places: SupabaseSavedPlacePayload } => Boolean(row.places))
        .map((row) => ({
          savedAt: row.created_at,
          place: normalizePlace(row.places),
        }));
      const counts = await getPlaceSaveCounts(places.map((item) => item.place.id));

      if (mounted) {
        setSavedPlaces(
          places.map((item) => ({
            ...item,
            place: { ...item.place, save_count: counts.get(item.place.id) ?? 0 },
          })),
        );
        setIsLoading(false);
      }
    }

    void loadSavedPlaces();

    function handleSaveChange() {
      void loadSavedPlaces();
    }

    window.addEventListener("place-save-change", handleSaveChange);

    return () => {
      mounted = false;
      window.removeEventListener("place-save-change", handleSaveChange);
    };
  }, [user]);

  const filteredPlaces = useMemo(() => {
    return category === "all" ? savedPlaces : savedPlaces.filter((item) => item.place.category === category);
  }, [category, savedPlaces]);

  async function removeSavedPlace(place: PlaceWithRelations) {
    const client = getSupabaseClient();

    if (!client || !user) {
      return;
    }

    const previous = savedPlaces;

    setSavedPlaces((current) => current.filter((item) => item.place.id !== place.id));

    const { error } = await client.from("place_saves").delete().eq("user_id", user.id).eq("place_id", place.id);

    if (error) {
      setSavedPlaces(previous);
      setStatus(error.message);
      return;
    }

    await recordPlaceEvent({
      eventType: "place_unsave",
      placeId: place.id,
      locale: currentLocale,
      userId: user.id,
      metadata: { source: "saved_page" },
    });
    window.dispatchEvent(new CustomEvent("place-save-change", { detail: { placeId: place.id } }));
  }

  if (loading || isLoading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-black text-slate-950">{copy.nav.saved}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">로그인하면 저장한 장소를 기기와 locale 변경 후에도 유지할 수 있습니다.</p>
          <Link
            href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(withLocale("/saved", currentLocale))}`}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
          >
            <LogIn size={17} aria-hidden="true" />
            로그인
          </Link>
        </section>
        <section>
          <SectionTitle title="최근 본 장소" subtitle="localStorage" />
          <div className="mt-4">
            <RecentPlacesView locale={currentLocale} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => {
            const active = category === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCategory(filter.value)}
                className={[
                  "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
                  active ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
                ].join(" ")}
              >
                {filter.label[currentLocale]}
              </button>
            );
          })}
        </div>

        {status ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}

        {filteredPlaces.length > 0 ? (
          <div className="space-y-3">
            {filteredPlaces.map(({ place }) => (
              <SavedPlaceCard key={place.id} place={place} locale={currentLocale} onRemove={() => void removeSavedPlace(place)} />
            ))}
          </div>
        ) : (
          <EmptyState title="저장한 장소가 없습니다" description="장소 카드나 상세페이지에서 저장을 눌러 추가하세요." />
        )}
      </section>

      <section>
        <SectionTitle title="최근 본 장소" subtitle="localStorage" />
        <div className="mt-4">
          <RecentPlacesView locale={currentLocale} />
        </div>
      </section>
    </div>
  );
}

function SavedPlaceCard({
  place,
  locale,
  onRemove,
}: {
  place: PlaceWithRelations;
  locale: Locale;
  onRemove: () => void;
}) {
  const content = getPlaceContent(place, locale);
  const href = withLocale(`/places/${place.slug}`, locale);

  return (
    <article className="grid grid-cols-[96px_1fr_auto] gap-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Link href={href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
        <Image src={place.thumbnail_url} alt={content.name} fill sizes="96px" className="object-cover" />
      </Link>
      <Link href={href} className="min-w-0 py-1">
        <p className="truncate text-base font-black text-slate-950">{content.name}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{content.secondaryName}</p>
        <p className="mt-3 text-xs font-semibold text-teal-700">
          {categoryLabels[place.category][locale]} · 저장 {place.save_count ?? 0}
        </p>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        className="grid size-9 place-items-center rounded-full bg-rose-50 text-rose-700 transition active:scale-95"
        aria-label="저장 취소"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </article>
  );
}

function normalizePlace(
  row: SupabaseSavedPlacePayload,
): PlaceWithRelations {
  const { place_translations: placeTranslations, place_tags: placeTags, place_menu_items: menuItems, ...place } = row;

  return {
    ...place,
    translations: placeTranslations ?? [],
    tags: placeTags?.map((item) => item.tags).filter((tag): tag is TagRecord => Boolean(tag)) ?? [],
    menu_items: menuItems ?? [],
  };
}
