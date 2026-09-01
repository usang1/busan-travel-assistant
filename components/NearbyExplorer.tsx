"use client";

import Image from "next/image";
import Link from "next/link";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronUp, Heart, MapPinned, Navigation, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DirectionsButton } from "@/components/DirectionsButton";
import { EmptyState } from "@/components/EmptyState";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import { TravelMap } from "@/components/TravelMap";
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
  formatOpeningStatus,
  getOpeningStatus,
  getPlaceDistance,
  gwangalliCenter,
  hasCoordinates,
  mapCategories,
  type Coordinates,
} from "@/lib/location";
import {
  chinaDiscoveryFilters,
  chinaPriceBuckets,
  chinaQuickFilters,
  countActiveChinaFilters,
  filterPlacesForChineseTraveler,
  getChinaDiscoveryTags,
  getChinaRecommendationLabel,
  getEnabledChinaFilters,
  sortPlacesForChineseTraveler,
  type ChinaDiscoveryFilter,
  type ChinaDiscoverySort,
  type ChinaPriceBucket,
} from "@/lib/place-china/discovery";
import { formatPriceRange } from "@/lib/place-store";
import { cn } from "@/lib/utils";
import { defaultLocale, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { getPreferredMapProvider, type MapBounds, type MapMarker } from "@/lib/map-provider";
import { getSupabaseClient } from "@/lib/supabase";
import { categoryLabels, type PlaceWithRelations } from "@/types/database";

type NearbyExplorerProps = {
  places: PlaceWithRelations[];
  locale?: Locale;
  loadError?: string;
};

type OriginMode = "current" | "gwangalli";
type MapCategoryFilter = "all" | "restaurant" | "cafe" | "attraction" | "shopping" | "saved";
type DistanceFilter = "all" | "500" | "1000" | "3000";

type PlaceListItem = {
  place: PlaceWithRelations;
  distance: number | null;
  walkingMinutes: number | null;
  openingStatus: ReturnType<typeof getOpeningStatus>;
};

const categoryOptions: Array<{ value: MapCategoryFilter; short: Record<Locale, string> }> = [
  { value: "all", short: { zh: "全部", en: "All", ja: "すべて", ko: "전체" } },
  { value: "restaurant", short: { zh: "美食", en: "Food", ja: "グルメ", ko: "맛집" } },
  { value: "cafe", short: categoryLabels.cafe },
  { value: "attraction", short: categoryLabels.attraction },
  { value: "shopping", short: categoryLabels.shopping },
  { value: "saved", short: { zh: "保存", en: "Saved", ja: "保存", ko: "저장" } },
];

const distanceOptions: Array<{ value: DistanceFilter; meters: number | null }> = [
  { value: "500", meters: 500 },
  { value: "1000", meters: 1000 },
  { value: "3000", meters: 3000 },
  { value: "all", meters: null },
];

function isInsideBounds(place: PlaceWithRelations, bounds: MapBounds | null) {
  if (!bounds || typeof place.latitude !== "number" || typeof place.longitude !== "number") {
    return true;
  }

  return (
    place.latitude >= bounds.minLat &&
    place.latitude <= bounds.maxLat &&
    place.longitude >= bounds.minLng &&
    place.longitude <= bounds.maxLng
  );
}

export function NearbyExplorer({ places, locale = defaultLocale, loadError }: NearbyExplorerProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const localizedCopy = nearbyCopy[locale];
  const [originMode, setOriginMode] = useState<OriginMode>("gwangalli");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState(localizedCopy.gwangalliBase);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState<MapCategoryFilter>(() => readCategory(searchParams));
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>(() => readDistanceFilter(searchParams));
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(() => new Set());
  const [filterNotice, setFilterNotice] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationFocusRequest, setLocationFocusRequest] = useState(0);
  const [priceBucket, setPriceBucket] = useState<ChinaPriceBucket>(() => readPriceBucket(searchParams));
  const [activeChinaFilters, setActiveChinaFilters] = useState<ChinaDiscoveryFilter[]>(() => readChinaFilters(searchParams));
  const [sortMode, setSortMode] = useState<ChinaDiscoverySort>(() => readSortMode(searchParams, "distance"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [appliedBounds, setAppliedBounds] = useState<MapBounds | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement | null>());
  const initialSelectionAppliedRef = useRef(false);
  const origin = originMode === "current" && userLocation ? userLocation : gwangalliCenter;
  const provider = getPreferredMapProvider();
  const copy = ui[locale];
  const showChinaFilters = locale === "zh";
  const availableChinaFilters = useMemo(() => (showChinaFilters ? getEnabledChinaFilters(places) : []), [places, showChinaFilters]);
  const availableQuickFilters = useMemo(
    () => availableChinaFilters.filter((filter) => chinaQuickFilters.includes(filter.key)),
    [availableChinaFilters],
  );
  const detailedChinaFilters = useMemo(
    () => availableChinaFilters.filter((filter) => !chinaQuickFilters.includes(filter.key)),
    [availableChinaFilters],
  );
  const activeFilterCount = countActiveChinaFilters(showChinaFilters ? activeChinaFilters : [], priceBucket);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (query.trim()) nextParams.set("q", query.trim());
    if (category !== "all") nextParams.set("category", category);
    if (distanceFilter !== "all") nextParams.set("distance", distanceFilter);
    if (priceBucket !== "all") nextParams.set("price", priceBucket);
    if (sortMode !== "distance") nextParams.set("sort", sortMode);

    if (showChinaFilters) {
      activeChinaFilters.forEach((filterKey) => {
        const filter = chinaDiscoveryFilters.find((item) => item.key === filterKey);

        if (filter) {
          nextParams.set(filter.queryKey, "true");
        }
      });
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [activeChinaFilters, category, distanceFilter, pathname, priceBucket, query, router, searchParams, showChinaFilters, sortMode]);

  useEffect(() => {
    let mounted = true;

    async function loadSavedPlaceIds() {
      const client = getSupabaseClient();

      if (!client || !user) {
        if (mounted) setSavedPlaceIds(new Set());
        return;
      }

      const { data, error } = await client
        .from("place_saves")
        .select("place_id")
        .eq("user_id", user.id);

      if (!mounted) return;

      if (error) {
        setSavedPlaceIds(new Set());
        setFilterNotice(localizedCopy.savedLoadFailed);
        return;
      }

      setSavedPlaceIds(new Set((data ?? []).map((row) => String(row.place_id))));
      setFilterNotice("");
    }

    void loadSavedPlaceIds();
    window.addEventListener("place-save-change", loadSavedPlaceIds);

    return () => {
      mounted = false;
      window.removeEventListener("place-save-change", loadSavedPlaceIds);
    };
  }, [localizedCopy.savedLoadFailed, user]);

  useEffect(() => {
    if (!authLoading && !user && category === "saved") {
      setCategory("all");
      setFilterNotice(localizedCopy.savedLoginRequired);
    }
  }, [authLoading, category, localizedCopy.savedLoginRequired, user]);

  const baseItems = useMemo(() => {
    return places
      .filter((place) => mapCategories.includes(place.category))
      .filter(hasCoordinates)
      .map((place) => {
        const distance = getPlaceDistance(place, origin);

        return {
          place,
          distance,
          walkingMinutes: estimateWalkingMinutes(distance),
          openingStatus: getOpeningStatus(place.opening_hours),
        };
      });
  }, [origin, places]);

  const filteredItems = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const chinaFilteredPlaces = new Set(
      filterPlacesForChineseTraveler(
        baseItems.map((item) => item.place),
        showChinaFilters ? activeChinaFilters : [],
        priceBucket,
      ).map((place) => place.id),
    );

    const filtered = baseItems
      .filter((item) => {
        const content = getPlaceContent(item.place, locale);
        const categoryMatch =
          category === "all" ||
          (category === "saved" && savedPlaceIds.has(item.place.id)) ||
          (category === "restaurant" && (item.place.category === "restaurant" || item.place.category === "bar")) ||
          item.place.category === category;
        const distanceFromUser = userLocation ? getPlaceDistance(item.place, userLocation) : null;
        const distanceLimit = distanceOptions.find((option) => option.value === distanceFilter)?.meters ?? null;
        const distanceMatch = distanceLimit === null || (distanceFromUser !== null && distanceFromUser <= distanceLimit);
        const boundsMatch = isInsideBounds(item.place, appliedBounds);
        const chinaMatch = chinaFilteredPlaces.has(item.place.id);
        const searchText = [
          content.name,
          content.secondaryName,
          content.description,
          content.address,
          item.place.name_zh,
          item.place.name_ko,
          item.place.address_zh,
          item.place.address_ko,
          item.place.nearest_station,
          categoryLabels[item.place.category][locale],
          ...getChinaDiscoveryTags(item.place, locale, 6),
        ]
          .join(" ")
          .toLowerCase();
        const searchMatch = lowered.length === 0 || searchText.includes(lowered);

        return categoryMatch && boundsMatch && searchMatch && chinaMatch && distanceMatch;
      });

    return sortPlacesForChineseTraveler(filtered, sortMode);
  }, [activeChinaFilters, appliedBounds, baseItems, category, distanceFilter, locale, priceBucket, query, savedPlaceIds, showChinaFilters, sortMode, userLocation]);

  const markers: MapMarker[] = useMemo(() => {
    return filteredItems.map(({ place, distance, walkingMinutes }) => {
      const content = getPlaceContent(place, locale);

      return {
        id: place.id,
        title: content.name,
        subtitle: content.secondaryName,
        category: place.category,
        position: {
          latitude: place.latitude,
          longitude: place.longitude,
        },
        href: withLocale(`/places/${place.slug}`, locale),
        imageUrl: place.thumbnail_url,
        meta: `${formatDistance(distance)} · ${copy.placeDetail.walkingApprox} ${walkingMinutes ?? place.walking_minutes}${copy.common.minutes}`,
        description: content.description,
        detailLabel: localizedCopy.detail,
        saveCount: place.save_count ?? 0,
        price: formatPriceRange(place, locale),
        recommendation: getChinaRecommendationLabel(place),
        tags: getChinaDiscoveryTags(place, locale, 4),
      };
    });
  }, [copy.common.minutes, copy.placeDetail.walkingApprox, filteredItems, locale, localizedCopy.detail]);

  const selectedItem = useMemo(() => {
    return selectedId ? filteredItems.find((item) => item.place.id === selectedId) ?? null : null;
  }, [filteredItems, selectedId]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    // eslint-disable-next-line no-console
    console.info("[nearby:client-filter]", {
      locale,
      activeFilters: {
        query: query.trim(),
        category,
        distanceFilter,
        savedOnly: category === "saved",
        priceBucket,
        chinaFilters: showChinaFilters ? activeChinaFilters : [],
        sortMode,
        appliedBounds: Boolean(appliedBounds),
        originMode,
      },
      rawPlacesCount: places.length,
      coordinateEligibleCount: baseItems.length,
      finalFilteredCount: filteredItems.length,
      loadError: loadError ?? null,
    });
  }, [activeChinaFilters, appliedBounds, baseItems.length, category, distanceFilter, filteredItems.length, loadError, locale, originMode, places.length, priceBucket, query, showChinaFilters, sortMode]);

  useEffect(() => {
    if (!initialSelectionAppliedRef.current && filteredItems[0]) {
      initialSelectionAppliedRef.current = true;
      setSelectedId(filteredItems[0].place.id);
      return;
    }

    if (selectedId && !selectedItem) {
      setSelectedId(null);
    }
  }, [filteredItems, selectedId, selectedItem]);

  function selectPlace(placeId: string, source: "card" | "marker") {
    setSelectedId(placeId);

    if (source === "marker") {
      window.setTimeout(() => {
        cardRefs.current.get(placeId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }

  function applyCurrentMapBounds(bounds = currentBounds) {
    if (!bounds) {
      return;
    }

    setAppliedBounds(bounds);
    setMapMoved(false);
    setSheetOpen(true);
  }

  function clearAreaSearch() {
    setAppliedBounds(null);
    setMapMoved(false);
  }

  function toggleChinaFilter(filter: ChinaDiscoveryFilter) {
    setActiveChinaFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setDistanceFilter("all");
    setFilterNotice("");
    setPriceBucket("all");
    setActiveChinaFilters([]);
    setSortMode("distance");
    clearAreaSearch();
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus(localizedCopy.locationUnsupported);
      setOriginMode("gwangalli");
      return;
    }

    setIsLocating(true);
    setLocationStatus(localizedCopy.locationChecking);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const distanceToGwangalli = calculateDistanceMeters(nextLocation, gwangalliCenter);

        setUserLocation(nextLocation);
        setOriginMode("current");
        setLocationFocusRequest((current) => current + 1);
        clearAreaSearch();
        setLocationStatus(`${localizedCopy.currentBase} ${localizedCopy.distanceToGwangalli} ${formatDistance(distanceToGwangalli)}.`);
        setIsLocating(false);
      },
      () => {
        setOriginMode("gwangalli");
        setLocationStatus(localizedCopy.locationDenied);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    );
  }

  function changeCategory(nextCategory: MapCategoryFilter) {
    if (nextCategory === "saved" && !user) {
      setFilterNotice(localizedCopy.savedLoginRequired);
      return;
    }

    setFilterNotice("");
    setCategory(nextCategory);
  }

  const searchControls = (
    <SearchAndFilters
      query={query}
      category={category}
      locale={locale}
      appliedBounds={appliedBounds}
      onQueryChange={setQuery}
      onCategoryChange={changeCategory}
      onClearArea={clearAreaSearch}
      locationStatus={locationStatus}
      filterNotice={filterNotice}
      userLoggedIn={Boolean(user)}
      userLocation={userLocation}
      distanceFilter={distanceFilter}
      onDistanceFilterChange={setDistanceFilter}
      priceBucket={priceBucket}
      sortMode={sortMode}
      activeChinaFilters={activeChinaFilters}
      activeFilterCount={activeFilterCount}
      availableQuickFilters={availableQuickFilters}
      detailedChinaFilters={detailedChinaFilters}
      showChinaFilters={showChinaFilters}
      onPriceBucketChange={setPriceBucket}
      onSortModeChange={setSortMode}
      onToggleChinaFilter={toggleChinaFilter}
      onClearFilters={clearFilters}
    />
  );

  const list = (
    <PlaceResultList
      items={filteredItems}
      selectedId={selectedItem?.place.id ?? null}
      locale={locale}
      rawPlacesCount={places.length}
      loadError={loadError}
      cardRefs={cardRefs}
      onSelect={(id) => selectPlace(id, "card")}
      onClearFilters={clearFilters}
    />
  );

  return (
    <div className="space-y-4 lg:space-y-0">
      <section className="lg:hidden">{searchControls}</section>

      <section className="hidden min-h-[calc(100vh-150px)] grid-cols-[minmax(320px,38%)_minmax(0,1fr)] gap-4 lg:grid">
        <aside className="flex min-h-0 flex-col rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 p-4">{searchControls}</div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{list}</div>
        </aside>
        <div className="sticky top-[88px] h-[calc(100vh-112px)] min-h-[560px]">
          <TravelMap
            center={origin}
            markers={markers}
            userLocation={originMode === "current" ? userLocation : null}
            currentLocationFocusRequest={locationFocusRequest}
            locationPending={isLocating}
            onRequestCurrentLocation={requestLocation}
            provider={provider}
            locale={locale}
            selectedId={selectedItem?.place.id ?? null}
            searchAreaVisible={mapMoved}
            onSearchArea={applyCurrentMapBounds}
            onSelectMarker={(id) => selectPlace(id, "marker")}
            onViewportSettled={(bounds, source) => {
              setCurrentBounds(bounds);
              if (source === "user") {
                setMapMoved(true);
              }
            }}
            className="h-full"
          />
        </div>
      </section>

      <section className="lg:hidden">
        <div className="relative h-[52vh] min-h-[360px]">
          <TravelMap
            center={origin}
            markers={markers}
            userLocation={originMode === "current" ? userLocation : null}
            currentLocationFocusRequest={locationFocusRequest}
            locationPending={isLocating}
            onRequestCurrentLocation={requestLocation}
            provider={provider}
            locale={locale}
            selectedId={selectedItem?.place.id ?? null}
            searchAreaVisible={mapMoved}
            onSearchArea={applyCurrentMapBounds}
            onSelectMarker={(id) => selectPlace(id, "marker")}
            onViewportSettled={(bounds, source) => {
              setCurrentBounds(bounds);
              if (source === "user") {
                setMapMoved(true);
              }
            }}
            className="h-full"
          />
        </div>

        {selectedItem ? (
          <div className="mt-3">
            <SelectedPlaceCard item={selectedItem} locale={locale} compact />
          </div>
        ) : null}

        <section
          className={cn(
            "fixed inset-x-0 z-40 rounded-t-[28px] bg-white shadow-[0_-14px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition-transform duration-200 lg:hidden",
            sheetOpen ? "bottom-0 translate-y-0" : "bottom-[76px] translate-y-[calc(100%-64px)]",
          )}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((current) => !current)}
            className="flex h-16 w-full items-center justify-between px-5 text-left"
          >
            <span>
              <span className="block text-sm font-black text-slate-950">{localizedCopy.placesCount} {filteredItems.length}</span>
              <span className="block text-xs text-slate-500">{localizedCopy.sheetSubtitle}</span>
            </span>
            <ChevronUp className={cn("text-slate-500 transition", sheetOpen && "rotate-180")} size={20} aria-hidden="true" />
          </button>
          <div className="max-h-[58vh] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">{list}</div>
        </section>
      </section>

      <p className="hidden text-center text-xs text-slate-500 lg:block">
        {copy.places.countLabel} {filteredItems.length} / {baseItems.length}
      </p>
    </div>
  );
}

function SearchAndFilters({
  query,
  category,
  locale,
  appliedBounds,
  locationStatus,
  filterNotice,
  userLoggedIn,
  userLocation,
  distanceFilter,
  priceBucket,
  sortMode,
  activeChinaFilters,
  activeFilterCount,
  availableQuickFilters,
  detailedChinaFilters,
  showChinaFilters,
  onQueryChange,
  onCategoryChange,
  onClearArea,
  onDistanceFilterChange,
  onPriceBucketChange,
  onSortModeChange,
  onToggleChinaFilter,
  onClearFilters,
}: {
  query: string;
  category: MapCategoryFilter;
  locale: Locale;
  appliedBounds: MapBounds | null;
  locationStatus: string;
  filterNotice: string;
  userLoggedIn: boolean;
  userLocation: Coordinates | null;
  distanceFilter: DistanceFilter;
  priceBucket: ChinaPriceBucket;
  sortMode: ChinaDiscoverySort;
  activeChinaFilters: ChinaDiscoveryFilter[];
  activeFilterCount: number;
  availableQuickFilters: typeof chinaDiscoveryFilters;
  detailedChinaFilters: typeof chinaDiscoveryFilters;
  showChinaFilters: boolean;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: MapCategoryFilter) => void;
  onClearArea: () => void;
  onDistanceFilterChange: (value: DistanceFilter) => void;
  onPriceBucketChange: (value: ChinaPriceBucket) => void;
  onSortModeChange: (value: ChinaDiscoverySort) => void;
  onToggleChinaFilter: (value: ChinaDiscoveryFilter) => void;
  onClearFilters: () => void;
}) {
  const copy = ui[locale];
  const localizedCopy = nearbyCopy[locale];

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] bg-slate-950 p-4 text-white lg:bg-transparent lg:p-0 lg:text-slate-950 lg:shadow-none">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10 lg:bg-teal-50 lg:text-teal-700 lg:ring-teal-100">
          <MapPinned size={16} aria-hidden="true" />
          {localizedCopy.origin}
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-normal lg:text-xl">{localizedCopy.heading}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300 lg:text-slate-500">{locationStatus}</p>
      </div>

      <label className="relative block">
        <span className="sr-only">{copy.places.searchPlaceholder}</span>
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={copy.places.searchPlaceholder}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[16px] text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto px-0.5 pb-1" aria-label={localizedCopy.categoryFilters}>
        {categoryOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onCategoryChange(option.value)}
            aria-pressed={category === option.value}
            title={option.value === "saved" && !userLoggedIn ? localizedCopy.savedLoginRequired : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-black ring-1 transition active:scale-95",
              category === option.value ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
            )}
          >
            {option.value === "saved" ? <Heart size={15} fill={category === "saved" ? "currentColor" : "none"} aria-hidden="true" /> : null}
            {option.short[locale]}
          </button>
        ))}
      </div>

      {userLocation ? (
        <div>
          <p className="mb-2 text-xs font-black text-slate-500">{localizedCopy.distanceRange}</p>
          <div className="grid grid-cols-4 gap-1.5" aria-label={localizedCopy.distanceRange}>
            {distanceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onDistanceFilterChange(option.value)}
                aria-pressed={distanceFilter === option.value}
                className={cn(
                  "min-h-11 rounded-xl px-1.5 py-1.5 text-xs font-black ring-1 transition active:scale-95",
                  distanceFilter === option.value
                    ? "bg-teal-700 text-white ring-teal-700"
                    : "bg-white text-slate-700 ring-slate-200",
                )}
              >
                <span className="block">{localizedCopy.distanceLabels[option.value]}</span>
                {option.value === "500" || option.value === "1000" ? (
                  <span className={cn("mt-0.5 block text-[10px] font-semibold", distanceFilter === option.value ? "text-teal-50" : "text-slate-400")}>
                    {localizedCopy.walkingLabels[option.value]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{localizedCopy.walkingEstimateNotice}</p>
        </div>
      ) : null}

      {filterNotice ? (
        <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-100">
          {filterNotice}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-black text-slate-500">{localizedCopy.price}</span>
          <select value={priceBucket} onChange={(event) => onPriceBucketChange(event.target.value as ChinaPriceBucket)} className={selectClass}>
            {chinaPriceBuckets.map((bucket) => (
              <option key={bucket.value} value={bucket.value}>
                {bucket.label[locale]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black text-slate-500">{localizedCopy.sort}</span>
          <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value as ChinaDiscoverySort)} className={selectClass}>
            <option value="chinaRecommended">{localizedCopy.recommendedSort}</option>
            <option value="saved">{localizedCopy.savedSort}</option>
            <option value="distance">{localizedCopy.distanceSort}</option>
            <option value="lowWait">{localizedCopy.lowWaitSort}</option>
          </select>
        </label>
      </div>

      {showChinaFilters && availableQuickFilters.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">{localizedCopy.quickFilters}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
              {localizedCopy.activeFilters} {activeFilterCount}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableQuickFilters.map((filter) => {
              const active = activeChinaFilters.includes(filter.key);

              return (
                <button key={filter.key} type="button" onClick={() => onToggleChinaFilter(filter.key)} className="shrink-0 active:scale-95">
                  <TagChip tone={active ? "green" : "default"}>{filter.compactLabel[locale]}</TagChip>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showChinaFilters && detailedChinaFilters.length ? (
        <details className="rounded-2xl bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-black text-slate-800">{localizedCopy.moreFilters}</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {detailedChinaFilters.map((filter) => {
              const active = activeChinaFilters.includes(filter.key);

              return (
                <button key={filter.key} type="button" onClick={() => onToggleChinaFilter(filter.key)} className="active:scale-95">
                  <TagChip tone={active ? "green" : "default"}>{filter.label[locale]}</TagChip>
                </button>
              );
            })}
          </div>
        </details>
      ) : null}

      {activeFilterCount > 0 || query || category !== "all" || distanceFilter !== "all" || appliedBounds ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
        >
          {localizedCopy.clearFilters}
        </button>
      ) : null}

      {appliedBounds ? (
        <button
          type="button"
          onClick={onClearArea}
          className="rounded-full bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-100"
        >
          {localizedCopy.clearArea}
        </button>
      ) : null}
    </div>
  );
}

function PlaceResultList({
  items,
  selectedId,
  locale,
  rawPlacesCount,
  loadError,
  cardRefs,
  onSelect,
  onClearFilters,
}: {
  items: PlaceListItem[];
  selectedId: string | null;
  locale: Locale;
  rawPlacesCount: number;
  loadError?: string;
  cardRefs: MutableRefObject<Map<string, HTMLDivElement | null>>;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  const copy = nearbyCopy[locale];

  if (items.length === 0) {
    return (
      <EmptyState
        title={loadError ? copy.loadErrorTitle : copy.emptyTitle}
        description={loadError ? copy.loadErrorDescription : rawPlacesCount === 0 ? copy.emptyDatabaseDescription : copy.emptyDescription}
        action={
          <button type="button" onClick={onClearFilters} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
            {copy.clearFilters}
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.place.id}
          ref={(node) => {
            cardRefs.current.set(item.place.id, node);
          }}
        >
          <PlaceListCard item={item} active={selectedId === item.place.id} locale={locale} onSelect={() => onSelect(item.place.id)} />
        </div>
      ))}
    </div>
  );
}

function PlaceListCard({
  item,
  active,
  locale,
  onSelect,
}: {
  item: PlaceListItem;
  active: boolean;
  locale: Locale;
  onSelect: () => void;
}) {
  const { place, distance, walkingMinutes, openingStatus } = item;
  const opening = formatOpeningStatus(place.opening_hours, locale);
  const content = getPlaceContent(place, locale);
  const href = withLocale(`/places/${place.slug}`, locale);
  const copy = ui[locale];
  const localizedCopy = nearbyCopy[locale];
  const coordinates = { latitude: place.latitude as number, longitude: place.longitude as number };
  const chinaTags = getChinaDiscoveryTags(place, locale, 4);
  const recommendation = getChinaRecommendationLabel(place);

  return (
    <article
      className={cn(
        "rounded-[24px] bg-white p-3 shadow-sm ring-1 transition",
        active ? "ring-2 ring-slate-950" : "ring-slate-200 hover:ring-teal-200",
      )}
    >
      <button type="button" onClick={onSelect} className="grid w-full grid-cols-[92px_1fr] gap-3 text-left">
        <span className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
          <Image src={place.thumbnail_url} alt={content.name} fill sizes="92px" className="object-cover" />
        </span>
        <span className="min-w-0 py-1">
          <span className="block truncate text-base font-black text-slate-950">{content.name}</span>
          {content.secondaryName ? <span className="mt-1 block truncate text-sm text-slate-500">{content.secondaryName}</span> : null}
          <span className="mt-3 flex flex-wrap gap-1.5">
            <TagChip tone={openingStatus === "unknown" ? "blue" : opening.tone}>{opening.text}</TagChip>
            <TagChip tone="blue">
              {formatDistance(distance)} · {walkingMinutes ?? place.walking_minutes}{copy.common.minutes}
            </TagChip>
            {locale === "zh" ? <TagChip tone="amber">推荐度 {recommendation}</TagChip> : null}
          </span>
        </span>
      </button>
      {locale === "zh" && chinaTags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chinaTags.map((tag) => (
            <TagChip key={tag}>{tag}</TagChip>
          ))}
        </div>
      ) : null}
      {content.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{content.description}</p> : null}
      {locale === "zh" ? (
        <p className="mt-2 text-xs font-bold text-slate-500">
          {formatPriceRange(place, locale)} · 收藏 {place.save_count ?? 0}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <Link href={href} className="inline-flex h-10 items-center justify-center gap-1 rounded-2xl px-3 text-sm font-black text-teal-700 transition hover:bg-teal-50">
          {localizedCopy.detail}
          <Navigation size={15} aria-hidden="true" />
        </Link>
        <div className="flex items-center gap-2">
          <DirectionsButton
            placeId={place.id}
            name={content.name}
            address={content.address}
            coordinates={coordinates}
            locale={locale}
            compact
          />
          <SaveButton
            initialSaveCount={place.save_count ?? 0}
            locale={locale}
            item={{
              id: place.id,
              type: "place",
              titleZh: place.name_zh,
              titleKo: place.name_ko,
              href,
              imageUrl: place.thumbnail_url,
              meta: `${categoryLabels[place.category][locale]} · ${formatDistance(distance)}`,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function SelectedPlaceCard({ item, locale, compact = false }: { item: PlaceListItem; locale: Locale; compact?: boolean }) {
  const { place, distance, walkingMinutes } = item;
  const content = getPlaceContent(place, locale);
  const href = withLocale(`/places/${place.slug}`, locale);
  const copy = ui[locale];
  const localizedCopy = nearbyCopy[locale];
  const coordinates = { latitude: place.latitude as number, longitude: place.longitude as number };
  const chinaTags = getChinaDiscoveryTags(place, locale, 4);

  return (
    <article className="grid grid-cols-[88px_1fr] gap-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Link href={href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
        <Image src={place.thumbnail_url} alt={content.name} fill sizes="88px" className="object-cover" />
      </Link>
      <div className="min-w-0">
        <Link href={href} className="block min-w-0 py-1">
          <p className="truncate text-base font-black text-slate-950">{content.name}</p>
          {content.secondaryName ? <p className="mt-1 truncate text-sm text-slate-500">{content.secondaryName}</p> : null}
          <p className="mt-2 text-xs font-bold text-teal-700">
            {categoryLabels[place.category][locale]} · {formatDistance(distance)} · {walkingMinutes ?? place.walking_minutes}
            {copy.common.minutes}
          </p>
          {locale === "zh" ? (
            <p className="mt-1 text-xs font-bold text-slate-500">
              推荐度 {getChinaRecommendationLabel(place)} · {formatPriceRange(place, locale)} · 收藏 {place.save_count ?? 0}
            </p>
          ) : null}
        </Link>
        {locale === "zh" && chinaTags.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chinaTags.map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        ) : null}
        {content.description ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{content.description}</p> : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-sm font-black text-teal-700 transition hover:bg-teal-50">
            {localizedCopy.detail}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2">
            <DirectionsButton
              placeId={place.id}
              name={content.name}
              address={content.address}
              coordinates={coordinates}
              locale={locale}
              compact
            />
            <SaveButton
              className={compact ? "px-2" : undefined}
              initialSaveCount={place.save_count ?? 0}
              locale={locale}
              item={{
                id: place.id,
                type: "place",
                titleZh: place.name_zh,
                titleKo: place.name_ko,
                href,
                imageUrl: place.thumbnail_url,
                meta: `${categoryLabels[place.category][locale]} · ${formatDistance(distance)}`,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

const nearbyCopy: Record<Locale, {
  gwangalliBase: string;
  locationUnsupported: string;
  locationChecking: string;
  currentBase: string;
  distanceToGwangalli: string;
  locationDenied: string;
  placesCount: string;
  sheetSubtitle: string;
  origin: string;
  heading: string;
  currentLocation: string;
  useMyLocation: string;
  clearArea: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyDatabaseDescription: string;
  loadErrorTitle: string;
  loadErrorDescription: string;
  detail: string;
  price: string;
  sort: string;
  recommendedSort: string;
  savedSort: string;
  distanceSort: string;
  lowWaitSort: string;
  quickFilters: string;
  moreFilters: string;
  activeFilters: string;
  clearFilters: string;
  categoryFilters: string;
  distanceRange: string;
  distanceLabels: Record<DistanceFilter, string>;
  walkingLabels: Record<"500" | "1000", string>;
  walkingEstimateNotice: string;
  savedLoginRequired: string;
  savedLoadFailed: string;
}> = {
  zh: {
    gwangalliBase: "以广安里为基准显示。",
    locationUnsupported: "此浏览器无法使用当前位置，将继续以广安里为基准显示。",
    locationChecking: "正在确认当前位置...",
    currentBase: "当前以你的位置为基准。",
    distanceToGwangalli: "到广安里中心约",
    locationDenied: "位置权限被拒绝，将继续以广安里为基准显示。",
    placesCount: "地点",
    sheetSubtitle: "按所选区域和筛选条件",
    origin: "当前位置 / 广安里",
    heading: "现在附近去哪？",
    currentLocation: "当前位置",
    useMyLocation: "我的位置",
    clearArea: "取消区域搜索",
    emptyTitle: "附近没有符合条件的地点",
    emptyDescription: "条件稍微减少一点，可以找到更多适合的地点。",
    emptyDatabaseDescription: "目前没有已公开且带坐标的地点。",
    loadErrorTitle: "无法载入地点信息",
    loadErrorDescription: "地点数据库查询失败。请稍后再试。",
    detail: "详情",
    price: "价格",
    sort: "排序",
    recommendedSort: "中国游客推荐",
    savedSort: "收藏顺序",
    distanceSort: "距离顺序",
    lowWaitSort: "少排队优先",
    quickFilters: "快速场景",
    moreFilters: "更多中国游客筛选",
    activeFilters: "已选",
    clearFilters: "全部清除",
    categoryFilters: "地点类型",
    distanceRange: "距当前位置",
    distanceLabels: { "500": "500m", "1000": "1km", "3000": "3km", all: "全部" },
    walkingLabels: { "500": "步行约5-10分", "1000": "步行约10-20分" },
    walkingEstimateNotice: "步行时间仅为距离换算的大致参考。",
    savedLoginRequired: "登录后可以只查看已保存的地点。",
    savedLoadFailed: "无法读取已保存的地点，请稍后重试。",
  },
  en: {
    gwangalliBase: "Showing results from Gwangalli.",
    locationUnsupported: "Current location is unavailable. Continuing from Gwangalli.",
    locationChecking: "Checking your current location...",
    currentBase: "Showing results from your current location.",
    distanceToGwangalli: "Distance to central Gwangalli:",
    locationDenied: "Location permission was denied. Continuing from Gwangalli.",
    placesCount: "Places",
    sheetSubtitle: "Based on selected area and filters",
    origin: "Current location / Gwangalli",
    heading: "Where nearby now?",
    currentLocation: "Current location",
    useMyLocation: "Use my location",
    clearArea: "Clear area search",
    emptyTitle: "No nearby places match",
    emptyDescription: "Move the map or reduce filters and try again.",
    emptyDatabaseDescription: "There are no published places with coordinates yet.",
    loadErrorTitle: "Could not load places",
    loadErrorDescription: "The place database query failed. Please try again later.",
    detail: "Details",
    price: "Price",
    sort: "Sort",
    recommendedSort: "Chinese traveler fit",
    savedSort: "Most saved",
    distanceSort: "Distance",
    lowWaitSort: "Short wait",
    quickFilters: "Quick filters",
    moreFilters: "More traveler filters",
    activeFilters: "Active",
    clearFilters: "Reset filters",
    categoryFilters: "Place categories",
    distanceRange: "From current location",
    distanceLabels: { "500": "500m", "1000": "1km", "3000": "3km", all: "All" },
    walkingLabels: { "500": "about 5-10 min", "1000": "about 10-20 min" },
    walkingEstimateNotice: "Walking times are rough distance-based estimates, not live directions.",
    savedLoginRequired: "Sign in to show only your saved places.",
    savedLoadFailed: "Saved places could not be loaded. Please try again.",
  },
  ja: {
    gwangalliBase: "広安里を基準に表示しています。",
    locationUnsupported: "このブラウザでは現在地を使用できません。広安里基準で続行します。",
    locationChecking: "現在地を確認しています...",
    currentBase: "現在地を基準に表示しています。",
    distanceToGwangalli: "広安里中心まで約",
    locationDenied: "位置情報の権限が拒否されました。広安里基準で続行します。",
    placesCount: "スポット",
    sheetSubtitle: "選択エリアとフィルター基準",
    origin: "現在地 / 広安里",
    heading: "今近くでどこへ行く？",
    currentLocation: "現在地",
    useMyLocation: "現在地を使う",
    clearArea: "エリア検索を解除",
    emptyTitle: "条件に合う近くのスポットがありません",
    emptyDescription: "地図を動かすか、フィルターを減らして再確認してください。",
    emptyDatabaseDescription: "公開済みで座標のあるスポットがまだありません。",
    loadErrorTitle: "スポット情報を読み込めません",
    loadErrorDescription: "スポットデータベースの取得に失敗しました。時間をおいて再確認してください。",
    detail: "詳細",
    price: "価格",
    sort: "並び替え",
    recommendedSort: "中国旅行者向け",
    savedSort: "保存順",
    distanceSort: "距離順",
    lowWaitSort: "待ち時間が短い順",
    quickFilters: "クイック条件",
    moreFilters: "旅行者向け条件",
    activeFilters: "選択中",
    clearFilters: "リセット",
    categoryFilters: "スポット種別",
    distanceRange: "現在地からの距離",
    distanceLabels: { "500": "500m", "1000": "1km", "3000": "3km", all: "すべて" },
    walkingLabels: { "500": "徒歩約5〜10分", "1000": "徒歩約10〜20分" },
    walkingEstimateNotice: "徒歩時間は距離換算による目安で、実際の経路時間ではありません。",
    savedLoginRequired: "ログインすると保存したスポットだけを表示できます。",
    savedLoadFailed: "保存したスポットを読み込めませんでした。時間をおいて再度お試しください。",
  },
  ko: {
    gwangalliBase: "광안리 기준으로 표시 중입니다.",
    locationUnsupported: "이 브라우저에서는 현재 위치를 사용할 수 없습니다. 광안리 기준으로 계속 표시합니다.",
    locationChecking: "현재 위치를 확인하는 중입니다...",
    currentBase: "현재 위치 기준입니다.",
    distanceToGwangalli: "광안리 중심까지",
    locationDenied: "위치 권한이 거부되었습니다. 광안리 기준으로 계속 표시합니다.",
    placesCount: "장소",
    sheetSubtitle: "선택한 지역과 필터 기준",
    origin: "현재 위치 / 광안리",
    heading: "지금 근처 어디 갈까?",
    currentLocation: "현재 위치",
    useMyLocation: "내 위치",
    clearArea: "지역 검색 해제",
    emptyTitle: "주변에 조건에 맞는 장소가 없습니다",
    emptyDescription: "지도를 움직이거나 필터를 줄여 다시 확인해 주세요.",
    emptyDatabaseDescription: "아직 공개됐고 좌표가 있는 장소가 없습니다.",
    loadErrorTitle: "장소 정보를 불러오지 못했습니다",
    loadErrorDescription: "장소 데이터베이스 조회에 실패했습니다. 잠시 후 다시 확인해 주세요.",
    detail: "상세",
    price: "가격대",
    sort: "정렬",
    recommendedSort: "중국인 추천도순",
    savedSort: "저장순",
    distanceSort: "거리순",
    lowWaitSort: "대기 적은 순",
    quickFilters: "빠른 상황 필터",
    moreFilters: "여행자 상세 필터",
    activeFilters: "적용",
    clearFilters: "전체 초기화",
    categoryFilters: "장소 유형",
    distanceRange: "현재 위치에서",
    distanceLabels: { "500": "500m", "1000": "1km", "3000": "3km", all: "전체" },
    walkingLabels: { "500": "도보 약 5~10분", "1000": "도보 약 10~20분" },
    walkingEstimateNotice: "도보 시간은 실제 경로 안내가 아닌 거리 기준의 대략적인 값입니다.",
    savedLoginRequired: "로그인하면 저장한 장소만 지도에서 볼 수 있습니다.",
    savedLoadFailed: "저장한 장소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
};

const selectClass = "h-11 w-full rounded-2xl bg-white px-3 text-sm font-bold text-slate-800 outline-none ring-1 ring-slate-200";

function readCategory(searchParams: URLSearchParams): MapCategoryFilter {
  const value = searchParams.get("category");

  if (value === "bar") return "restaurant";
  return categoryOptions.some((option) => option.value === value) ? (value as MapCategoryFilter) : "all";
}

function readDistanceFilter(searchParams: URLSearchParams): DistanceFilter {
  const value = searchParams.get("distance");

  return distanceOptions.some((option) => option.value === value) ? (value as DistanceFilter) : "all";
}

function readChinaFilters(searchParams: URLSearchParams): ChinaDiscoveryFilter[] {
  return chinaDiscoveryFilters
    .filter((filter) => searchParams.get(filter.queryKey) === "true")
    .map((filter) => filter.key);
}

function readPriceBucket(searchParams: URLSearchParams): ChinaPriceBucket {
  const value = searchParams.get("price");

  return chinaPriceBuckets.some((bucket) => bucket.value === value) ? (value as ChinaPriceBucket) : "all";
}

function readSortMode(searchParams: URLSearchParams, fallback: ChinaDiscoverySort): ChinaDiscoverySort {
  const value = searchParams.get("sort");

  return value === "chinaRecommended" || value === "saved" || value === "distance" || value === "lowWait" ? value : fallback;
}
