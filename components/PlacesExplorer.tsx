"use client";

import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceRankingSection } from "@/components/PlaceRankingSection";
import { TagChip } from "@/components/TagChip";
import {
  calculateDistanceMeters,
  formatDistance,
  formatOpeningStatus,
  type Coordinates,
} from "@/lib/location";
import {
  chinaDiscoveryFilters,
  chinaPriceBuckets,
  chinaQuickFilters,
  countActiveChinaFilters,
  filterPlacesForChineseTraveler,
  getEnabledChinaFilters,
  sortPlacesForChineseTraveler,
  type ChinaDiscoveryFilter,
  type ChinaDiscoverySort,
  type ChinaPriceBucket,
} from "@/lib/place-china/discovery";
import { cn } from "@/lib/utils";
import { defaultLocale, getPlaceContent, type Locale, ui } from "@/lib/i18n";
import { categoryLabels, type PlaceCategory, type PlaceRankingCollection, type PlaceWithRelations } from "@/types/database";

type PlacesExplorerProps = {
  places: PlaceWithRelations[];
  initialCategory?: string;
  locale?: Locale;
  loadError?: string;
  rankings: PlaceRankingCollection;
};

type SortMode = ChinaDiscoverySort;

const categoryFilters: Array<{ value: PlaceCategory | "all" }> = [
  { value: "all" },
  { value: "restaurant" },
  { value: "cafe" },
  { value: "bar" },
  { value: "attraction" },
  { value: "shopping" },
  { value: "photo_spot" },
  { value: "luggage" },
];

export function PlacesExplorer({ places, initialCategory, locale = defaultLocale, loadError, rankings }: PlacesExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState<PlaceCategory | "all">(
    getInitialCategory(searchParams, initialCategory),
  );
  const [region, setRegion] = useState(() => searchParams.get("region") ?? "all");
  const [priceBucket, setPriceBucket] = useState<ChinaPriceBucket>(() => readPriceBucket(searchParams));
  const [activeChinaFilters, setActiveChinaFilters] = useState<ChinaDiscoveryFilter[]>(() => readChinaFilters(searchParams));
  const [sortMode, setSortMode] = useState<SortMode>(() => readSortMode(searchParams));
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const copy = ui[locale];
  const explorerCopy = placesExplorerCopy[locale];
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
  const regions = useMemo(() => buildRegions(places), [places]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (query.trim()) nextParams.set("q", query.trim());
    if (category !== "all") nextParams.set("category", category);
    if (region !== "all") nextParams.set("region", region);
    if (priceBucket !== "all") nextParams.set("price", priceBucket);
    if (sortMode !== "chinaRecommended") nextParams.set("sort", sortMode);

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
  }, [activeChinaFilters, category, pathname, priceBucket, query, region, router, searchParams, showChinaFilters, sortMode]);

  const enrichedPlaces = useMemo(() => {
    return places.map((place) => ({
      place,
      distance: userLocation && typeof place.latitude === "number" && typeof place.longitude === "number"
        ? calculateDistanceMeters(userLocation, { latitude: place.latitude, longitude: place.longitude })
        : null,
    }));
  }, [places, userLocation]);

  const filteredPlaces = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const chinaFilteredPlaces = new Set(
      filterPlacesForChineseTraveler(
        enrichedPlaces.map((item) => item.place),
        showChinaFilters ? activeChinaFilters : [],
        priceBucket,
      ).map((place) => place.id),
    );

    const filtered = enrichedPlaces
      .filter(({ place }) => {
        const categoryMatch = category === "all" || place.category === category;
        const regionMatch = region === "all" || getRegionKey(place) === region;
        const searchMatch = lowered.length === 0 || buildSearchText(place, locale).includes(lowered);
        const chinaMatch = chinaFilteredPlaces.has(place.id);

        return categoryMatch && regionMatch && searchMatch && chinaMatch;
      });

    return sortPlacesForChineseTraveler(filtered, sortMode);
  }, [activeChinaFilters, category, enrichedPlaces, locale, priceBucket, query, region, showChinaFilters, sortMode]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    // eslint-disable-next-line no-console
    console.info("[places:client-filter]", {
      locale,
      activeFilters: {
        query: query.trim(),
        category,
        region,
        priceBucket,
        chinaFilters: showChinaFilters ? activeChinaFilters : [],
        sortMode,
      },
      rawPlacesCount: places.length,
      finalFilteredCount: filteredPlaces.length,
      loadError: loadError ?? null,
    });
  }, [activeChinaFilters, category, filteredPlaces.length, loadError, locale, places.length, priceBucket, query, region, showChinaFilters, sortMode]);

  function toggleChinaFilter(filter: ChinaDiscoveryFilter) {
    setActiveChinaFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setRegion("all");
    setPriceBucket("all");
    setActiveChinaFilters([]);
    setSortMode("chinaRecommended");
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationMessage(explorerCopy.locationUnsupported);
      return;
    }

    setLocationMessage(explorerCopy.locationChecking);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setSortMode("distance");
        setLocationMessage(explorerCopy.locationReady);
      },
      () => {
        setLocationMessage(explorerCopy.locationDenied);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <div>
      <div className="space-y-4 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label className="relative block">
          <span className="sr-only">{copy.places.searchPlaceholder}</span>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.places.searchPlaceholder}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-[16px] text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoryFilters.map((filter) => {
            const active = category === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCategory(filter.value)}
                className={filterClass(active)}
              >
                {filter.value === "all" ? copy.places.all : categoryLabels[filter.value][locale]}
              </button>
            );
          })}
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200">
            <SlidersHorizontal size={18} aria-hidden="true" />
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.region}</span>
            <select value={region} onChange={(event) => setRegion(event.target.value)} className={selectClass}>
              <option value="all">{explorerCopy.allRegions}</option>
              {regions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.price}</span>
            <select value={priceBucket} onChange={(event) => setPriceBucket(event.target.value as ChinaPriceBucket)} className={selectClass}>
              {chinaPriceBuckets.map((bucket) => (
                <option key={bucket.value} value={bucket.value}>{bucket.label[locale]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.sort}</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={selectClass}>
              <option value="chinaRecommended">{explorerCopy.recommendedSort}</option>
              <option value="saved">{explorerCopy.savedSort}</option>
              <option value="distance" disabled={!userLocation}>{explorerCopy.distanceSort}</option>
              <option value="lowWait">{explorerCopy.lowWaitSort}</option>
            </select>
          </label>
        </div>

        {showChinaFilters && availableQuickFilters.length ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-500">{explorerCopy.quickFilters}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                {explorerCopy.activeFilters} {activeFilterCount}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {availableQuickFilters.map((filter) => {
                const active = activeChinaFilters.includes(filter.key);

                return (
                  <button key={filter.key} type="button" onClick={() => toggleChinaFilter(filter.key)} className="shrink-0 active:scale-95">
                    <TagChip tone={active ? "green" : "default"}>{filter.compactLabel[locale]}</TagChip>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {showChinaFilters && detailedChinaFilters.length ? (
          <details className="rounded-2xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-black text-slate-800">
              {explorerCopy.moreFilters}
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {detailedChinaFilters.map((filter) => {
                const active = activeChinaFilters.includes(filter.key);

                return (
                  <button key={filter.key} type="button" onClick={() => toggleChinaFilter(filter.key)} className="active:scale-95">
                    <TagChip tone={active ? "green" : "default"}>{filter.label[locale]}</TagChip>
                  </button>
                );
              })}
            </div>
          </details>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={requestLocation} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700 ring-1 ring-blue-100">
            <LocateFixed size={14} aria-hidden="true" />
            {explorerCopy.distanceSort}
          </button>
          {activeFilterCount > 0 || query || category !== "all" || region !== "all" ? (
            <button type="button" onClick={clearFilters} className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-black text-white">
              {explorerCopy.clearFilters}
            </button>
          ) : null}
        </div>

        {locationMessage ? <p className="text-xs font-semibold text-slate-500">{locationMessage}</p> : null}
      </div>

      <PlaceRankingSection rankings={rankings} locale={locale} />

      {filteredPlaces.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {filteredPlaces.map(({ place, distance }, index) => (
            <PlaceCard key={place.id} place={place} priority={index === 0} locale={locale} distanceMeters={distance} />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState
            title={loadError ? explorerCopy.loadErrorTitle : copy.places.emptyTitle}
            description={loadError ? explorerCopy.loadErrorDescription : places.length === 0 ? explorerCopy.emptyDatabaseDescription : explorerCopy.reduceFilters}
            action={
              <button type="button" onClick={clearFilters} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                {explorerCopy.clearFilters}
              </button>
            }
          />
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-500">
        {copy.places.countLabel} {filteredPlaces.length} / {places.length}
      </p>
    </div>
  );
}

const placesExplorerCopy: Record<Locale, {
  region: string;
  allRegions: string;
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
  reduceFilters: string;
  emptyDatabaseDescription: string;
  loadErrorTitle: string;
  loadErrorDescription: string;
  popular: string;
  savedBased: string;
  locationUnsupported: string;
  locationChecking: string;
  locationReady: string;
  locationDenied: string;
}> = {
  zh: {
    region: "区域",
    allRegions: "全部区域",
    price: "价格",
    sort: "排序",
    recommendedSort: "推荐顺序",
    savedSort: "收藏顺序",
    distanceSort: "距离顺序",
    lowWaitSort: "少排队优先",
    quickFilters: "快速场景",
    moreFilters: "更多中国游客筛选",
    activeFilters: "已选",
    clearFilters: "全部清除",
    reduceFilters: "条件稍微减少一点，可以找到更多适合的地点。",
    emptyDatabaseDescription: "目前没有已公开的地点。",
    loadErrorTitle: "无法载入地点信息",
    loadErrorDescription: "地点数据库查询失败。请稍后再试。",
    popular: "热门地点",
    savedBased: "按收藏数",
    locationUnsupported: "此浏览器无法使用当前位置。",
    locationChecking: "正在确认当前位置...",
    locationReady: "可以按当前位置距离排序。",
    locationDenied: "位置权限被拒绝。仍可继续使用其他搜索功能。",
  },
  en: {
    region: "Region",
    allRegions: "All regions",
    price: "Price",
    sort: "Sort",
    recommendedSort: "Recommended",
    savedSort: "Most saved",
    distanceSort: "Distance",
    lowWaitSort: "Short wait",
    quickFilters: "Quick filters",
    moreFilters: "More traveler filters",
    activeFilters: "Active",
    clearFilters: "Reset filters",
    reduceFilters: "Try removing a few filters to see more places.",
    emptyDatabaseDescription: "There are no published places yet.",
    loadErrorTitle: "Could not load places",
    loadErrorDescription: "The place database query failed. Please try again later.",
    popular: "Popular places",
    savedBased: "Based on saves",
    locationUnsupported: "Current location is unavailable in this browser.",
    locationChecking: "Checking your current location...",
    locationReady: "Distance sorting is available from your current location.",
    locationDenied: "Location permission was denied. Other search features remain available.",
  },
  ja: {
    region: "エリア",
    allRegions: "すべてのエリア",
    price: "価格",
    sort: "並び替え",
    recommendedSort: "おすすめ順",
    savedSort: "保存順",
    distanceSort: "距離順",
    lowWaitSort: "待ち時間が短い順",
    quickFilters: "クイック条件",
    moreFilters: "旅行者向け条件",
    activeFilters: "選択中",
    clearFilters: "リセット",
    reduceFilters: "条件を少し減らすと、より多くのスポットが見つかります。",
    emptyDatabaseDescription: "公開済みスポットがまだありません。",
    loadErrorTitle: "スポット情報を読み込めません",
    loadErrorDescription: "スポットデータベースの取得に失敗しました。時間をおいて再確認してください。",
    popular: "人気スポット",
    savedBased: "保存数基準",
    locationUnsupported: "このブラウザでは現在地を使用できません。",
    locationChecking: "現在地を確認しています...",
    locationReady: "現在地から距離順で並び替えできます。",
    locationDenied: "位置情報の権限が拒否されました。他の検索機能は利用できます。",
  },
  ko: {
    region: "지역",
    allRegions: "전체 지역",
    price: "가격대",
    sort: "정렬",
    recommendedSort: "추천순",
    savedSort: "저장순",
    distanceSort: "거리순",
    lowWaitSort: "대기 적은 순",
    quickFilters: "빠른 상황 필터",
    moreFilters: "여행자 상세 필터",
    activeFilters: "적용",
    clearFilters: "전체 초기화",
    reduceFilters: "조건을 조금 줄이면 더 많은 장소를 찾을 수 있어요.",
    emptyDatabaseDescription: "아직 공개된 장소가 없습니다.",
    loadErrorTitle: "장소 정보를 불러오지 못했습니다",
    loadErrorDescription: "장소 데이터베이스 조회에 실패했습니다. 잠시 후 다시 확인해 주세요.",
    popular: "인기 장소",
    savedBased: "저장 수 기반",
    locationUnsupported: "이 브라우저에서는 현재 위치를 사용할 수 없습니다.",
    locationChecking: "현재 위치를 확인하는 중입니다...",
    locationReady: "현재 위치 기준 거리순 정렬을 사용할 수 있습니다.",
    locationDenied: "위치 권한이 거부되었습니다. 다른 검색 기능은 계속 사용할 수 있습니다.",
  },
};

function buildSearchText(place: PlaceWithRelations, locale: Locale) {
  const content = getPlaceContent(place, locale);

  return [
    content.name,
    content.secondaryName,
    content.description,
    content.address,
    place.name_zh,
    place.name_ko,
    place.short_description_zh,
    place.short_description_ko,
    place.address_zh,
    place.address_ko,
    place.address,
    place.nearest_station,
    place.nearest_exit,
    categoryLabels[place.category].zh,
    categoryLabels[place.category].en,
    categoryLabels[place.category].ja,
    categoryLabels[place.category].ko,
    ...place.tags.map((tag) => `${tag.label_zh} ${tag.label_ko} ${tag.slug}`),
    ...(place.translations ?? []).flatMap((translation) => [
      translation.locale,
      translation.name,
      translation.description,
      translation.travel_tip,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildRegions(places: PlaceWithRelations[]) {
  const regions = new Map<string, string>();

  for (const place of places) {
    const key = getRegionKey(place);

    if (key !== "unknown") {
      regions.set(key, key);
    }
  }

  return Array.from(regions.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

function getRegionKey(place: PlaceWithRelations) {
  const address = place.address_ko || place.address_zh || "";
  const guMatch = address.match(/부산\s+([^\s]+구)/);
  const dongMatch = address.match(/([가-힣]+동)/);

  return dongMatch?.[1] ?? guMatch?.[1] ?? place.nearest_station ?? "unknown";
}

function filterClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
    active ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
  );
}

const selectClass = "h-11 w-full rounded-2xl bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none ring-1 ring-slate-200";

function getInitialCategory(searchParams: URLSearchParams, initialCategory?: string) {
  const categoryParam = searchParams.get("category") ?? initialCategory;

  return categoryFilters.some((filter) => filter.value === categoryParam) ? (categoryParam as PlaceCategory) : "all";
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

function readSortMode(searchParams: URLSearchParams): SortMode {
  const value = searchParams.get("sort");

  return value === "saved" || value === "distance" || value === "lowWait" ? value : "chinaRecommended";
}
