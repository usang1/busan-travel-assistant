"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { List, Map, Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { AddToTripButton } from "@/components/AddToTripButton";
import { TravelMap } from "@/components/TravelMap";
import { useAuth } from "@/components/AuthProvider";
import { gwangalliCenter, hasCoordinates } from "@/lib/location";
import { getPreferredMapProvider, type MapMarker } from "@/lib/map-provider";
import { recordPlaceEvent } from "@/lib/place-events";
import { getPlaceSaveCounts } from "@/lib/place-saves";
import { getPublicPlacesByIds } from "@/lib/place-store";
import { getSavedPlaceIds, removeSavedItem, savedItemsChangeEvent } from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { categoryLabels, type PlaceTranslationRecord, type PlaceWithRelations, type TagRecord } from "@/types/database";

type SavedPlace = {
  savedAt: string;
  place: PlaceWithRelations;
};

type SavedItemsViewProps = {
  locale?: Locale;
  compact?: boolean;
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

type SavedRegion = "all" | "gwangalli" | "haeundae" | "seomyeon" | "nampo" | "other";
type ViewMode = "list" | "map";

const filters: Array<{ value: SavedRegion; label: Record<Locale, string> }> = [
  { value: "all", label: { zh: "全部", en: "All", ja: "すべて", ko: "전체" } },
  { value: "gwangalli", label: { zh: "广安里", en: "Gwangalli", ja: "広安里", ko: "광안리" } },
  { value: "haeundae", label: { zh: "海云台", en: "Haeundae", ja: "海雲台", ko: "해운대" } },
  { value: "seomyeon", label: { zh: "西面", en: "Seomyeon", ja: "西面", ko: "서면" } },
  { value: "nampo", label: { zh: "南浦", en: "Nampo", ja: "南浦", ko: "남포" } },
  { value: "other", label: { zh: "其他", en: "Other", ja: "その他", ko: "기타" } },
];

export function SavedItemsView({ locale, compact = false }: SavedItemsViewProps) {
  const pathname = usePathname();
  const currentLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = ui[currentLocale];
  const { user, loading } = useAuth();
  const text = savedCopy[currentLocale];
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [region, setRegion] = useState<SavedRegion>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSavedPlaces() {
      const client = getSupabaseClient();

      if (!user) {
        setIsLoading(true);
        const ids = getSavedPlaceIds();
        const places = await withTimeout(getPublicPlacesByIds(ids, client ?? undefined), 8000, []);

        if (mounted) {
          setSavedPlaces(places.map((place) => ({ place, savedAt: "" })));
          setStatus("");
          setIsLoading(false);
        }
        return;
      }

      if (!client) {
        if (mounted) {
          setSavedPlaces([]);
          setStatus(text.loadFailed);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      const { data, error } = await withTimeout(client
        .from("place_saves")
        .select("created_at, places(*, place_translations(*), place_tags(tags(*)), place_menu_items(*))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }), 8000, { data: null, error: { message: text.loadFailed } });

      if (!mounted) {
        return;
      }

      if (error || !data) {
        setStatus(error?.message ?? copy.common.noInfo);
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
    window.addEventListener(savedItemsChangeEvent, handleSaveChange);
    window.addEventListener("storage", handleSaveChange);

    return () => {
      mounted = false;
      window.removeEventListener("place-save-change", handleSaveChange);
      window.removeEventListener(savedItemsChangeEvent, handleSaveChange);
      window.removeEventListener("storage", handleSaveChange);
    };
  }, [copy.common.noInfo, text.loadFailed, user]);

  const filteredPlaces = useMemo(() => {
    return region === "all" ? savedPlaces : savedPlaces.filter((item) => getSavedPlaceRegion(item.place) === region);
  }, [region, savedPlaces]);

  useEffect(() => {
    if (loading || isLoading) return;

    void recordPlaceEvent({
      eventType: "saved_list_view",
      locale: currentLocale,
      userId: user?.id,
      metadata: {
        saved_place_count: savedPlaces.length,
        region,
        source: compact ? "mypage" : "saved_page",
      },
    });
  }, [compact, currentLocale, isLoading, loading, region, savedPlaces.length, user?.id]);

  useEffect(() => {
    if (loading || isLoading || viewMode !== "map") return;

    void recordPlaceEvent({
      eventType: "saved_map_view",
      locale: currentLocale,
      userId: user?.id,
      metadata: {
        saved_place_count: filteredPlaces.length,
        region,
        source: compact ? "mypage" : "saved_page",
      },
    });
  }, [compact, currentLocale, filteredPlaces.length, isLoading, loading, region, user?.id, viewMode]);

  async function removeSavedPlace(place: PlaceWithRelations) {
    const client = getSupabaseClient();

    if (!client || !user) {
      removeSavedItem({ id: place.id, type: "place" });
      setSavedPlaces((current) => current.filter((item) => item.place.id !== place.id));
      window.dispatchEvent(new CustomEvent("place-save-change", { detail: { placeId: place.id, saved: false } }));
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
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{copy.common.loading}</div>;
  }

  return (
    <div className="space-y-6">
      {!user ? (
        <section className="rounded-[24px] bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-900 ring-1 ring-teal-100">
          {text.guestHint}
          <Link href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(withLocale("/saved", currentLocale))}`} className="ml-2 font-black underline">
            {copy.auth.login}
          </Link>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => {
            const active = region === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRegion(filter.value)}
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

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          <button type="button" onClick={() => setViewMode("list")} className={viewToggleClass(viewMode === "list")}>
            <List size={16} aria-hidden="true" />
            {text.list}
          </button>
          <button type="button" onClick={() => setViewMode("map")} className={viewToggleClass(viewMode === "map")}>
            <Map size={16} aria-hidden="true" />
            {text.map}
          </button>
        </div>

        {status ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}

        {filteredPlaces.length > 0 && viewMode === "map" ? (
          <SavedPlacesMap places={filteredPlaces.map((item) => item.place)} locale={currentLocale} />
        ) : filteredPlaces.length > 0 ? (
          <div className="space-y-3">
            {filteredPlaces.map(({ place }) => (
              <SavedPlaceCard key={place.id} place={place} locale={currentLocale} onRemove={() => void removeSavedPlace(place)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.mypage.savedEmptyTitle}
            description={copy.mypage.savedEmptyDescription}
            action={
              <Link href={withLocale("/places", currentLocale)} className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white">
                {copy.common.explorePlaces}
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}

function SavedPlacesMap({ places, locale }: { places: PlaceWithRelations[]; locale: Locale }) {
  const [selectedId, setSelectedId] = useState<string | null>(places.find(hasCoordinates)?.id ?? null);
  const mapPlaces = places.filter(hasCoordinates);
  const selectedPlace = mapPlaces.find((place) => place.id === selectedId) ?? mapPlaces[0] ?? null;
  const center = mapPlaces.length ? centerOfPlaces(mapPlaces) : gwangalliCenter;
  const text = savedCopy[locale];
  const markers: MapMarker[] = mapPlaces.map((place) => {
    const content = getPlaceContent(place, locale);
    const href = withLocale(`/places/${place.slug}`, locale);

    return {
      id: place.id,
      title: content.name,
      subtitle: categoryLabels[place.category][locale],
      category: place.category,
      position: { latitude: place.latitude, longitude: place.longitude },
      href,
      imageUrl: place.thumbnail_url,
      meta: [categoryLabels[place.category][locale], content.address].filter(Boolean).join(" · "),
      description: content.description,
      detailLabel: text.detail,
      saveCount: place.save_count ?? 0,
    };
  });

  return (
    <div className="space-y-3">
      <TravelMap
        center={center}
        markers={markers}
        provider={getPreferredMapProvider()}
        locale={locale}
        selectedId={selectedPlace?.id ?? null}
        onSelectMarker={setSelectedId}
        className="h-[460px]"
      />
      {selectedPlace ? <SavedMapSelection place={selectedPlace} locale={locale} /> : null}
    </div>
  );
}

function SavedMapSelection({ place, locale }: { place: PlaceWithRelations; locale: Locale }) {
  const content = getPlaceContent(place, locale);
  const href = withLocale(`/places/${place.slug}`, locale);
  const text = savedCopy[locale];

  return (
    <article className="grid grid-cols-[76px_1fr] gap-3 rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Link href={href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
        <Image src={place.thumbnail_url} alt={content.name} fill sizes="76px" className="object-cover" />
      </Link>
      <div className="min-w-0">
        <p className="truncate text-base font-black text-slate-950">{content.name}</p>
        <p className="mt-1 text-xs font-bold text-teal-700">{categoryLabels[place.category][locale]}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{content.description}</p>
        <Link href={href} className="mt-2 inline-flex min-h-10 items-center rounded-full bg-teal-700 px-4 text-sm font-black text-white">
          {text.detail}
        </Link>
      </div>
    </article>
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
    <article className="grid grid-cols-[88px_1fr] gap-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Link href={href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
        <Image src={place.thumbnail_url} alt={content.name} fill sizes="88px" className="object-cover" />
      </Link>
      <div className="min-w-0 py-1">
        <Link href={href} className="block min-w-0">
          <p className="truncate text-base font-black text-slate-950">{content.name}</p>
          {content.secondaryName ? <p className="mt-1 truncate text-sm text-slate-500">{content.secondaryName}</p> : null}
          <p className="mt-2 text-xs font-semibold text-teal-700">{categoryLabels[place.category][locale]} · {place.save_count ?? 0}</p>
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AddToTripButton placeId={place.id} locale={locale} />
          <button type="button" onClick={onRemove} className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100 transition active:scale-95" aria-label="저장 취소">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

async function withTimeout<T, F>(promise: PromiseLike<T>, timeoutMs: number, fallback: F): Promise<T | F> {
  return Promise.race([
    promise,
    new Promise<F>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

const savedCopy: Record<Locale, { guestHint: string; loadFailed: string; list: string; map: string; detail: string }> = {
  zh: { guestHint: "未登录也可以在此设备收藏地点和路线。登录后会自动合并到账号，失败时不会删除本机收藏。", loadFailed: "无法载入收藏的地点。请稍后再试。", list: "清单", map: "地图", detail: "查看地点" },
  en: { guestHint: "You can save places and courses on this device without signing in. They merge after sign-in; local saves stay if merging fails.", loadFailed: "Saved places could not be loaded. Please try again.", list: "List", map: "Map", detail: "View place" },
  ja: { guestHint: "ログインしなくてもこの端末にスポットとコースを保存できます。ログイン後に統合し、失敗した場合は端末内の保存を残します。", loadFailed: "保存したスポットを読み込めませんでした。時間をおいて再試行してください。", list: "リスト", map: "地図", detail: "スポット詳細" },
  ko: { guestHint: "로그인하지 않아도 이 기기에 장소와 코스를 저장할 수 있습니다. 로그인하면 계정에 병합하며, 실패해도 기기 저장 데이터는 지우지 않습니다.", loadFailed: "저장한 장소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", list: "리스트", map: "지도", detail: "장소 보기" },
};

function getSavedPlaceRegion(place: PlaceWithRelations): SavedRegion {
  const text = `${place.address_ko} ${place.address_zh} ${place.nearest_station} ${place.name_ko} ${place.name_zh}`.toLowerCase();
  if (text.includes("광안") || text.includes("广安")) return "gwangalli";
  if (text.includes("해운대") || text.includes("海云台") || text.includes("海雲台")) return "haeundae";
  if (text.includes("서면") || text.includes("西面")) return "seomyeon";
  if (text.includes("남포") || text.includes("南浦")) return "nampo";
  return "other";
}

function centerOfPlaces(places: Array<PlaceWithRelations & { latitude: number; longitude: number }>) {
  return {
    latitude: places.reduce((sum, place) => sum + place.latitude, 0) / places.length,
    longitude: places.reduce((sum, place) => sum + place.longitude, 0) / places.length,
  };
}

function viewToggleClass(active: boolean) {
  return [
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition active:scale-95",
    active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
  ].join(" ");
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
