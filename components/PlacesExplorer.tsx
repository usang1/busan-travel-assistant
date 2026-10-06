"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LocateFixed, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceRankingSection } from "@/components/PlaceRankingSection";
import { TagChip } from "@/components/TagChip";
import { cityRegions, getPlaceRegion, placeCities, placeCityCenters, placeRegionLabel, type PlaceCity } from "@/lib/city-regions";
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
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
  hasVerifiedRecommendationScores,
  matchesTimeAwareFilter,
  sortPlacesForChineseTraveler,
  timeAwareDiscoveryFilters,
  type ChinaDiscoveryFilter,
  type ChinaDiscoverySort,
  type ChinaPriceBucket,
} from "@/lib/place-china/discovery";
import { cn } from "@/lib/utils";
import { defaultLocale, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { readPlacesSearchQuery } from "@/lib/place-search-url";
import { getHomeIntentKeyFromSlug, getHomeIntentLabel, isHomeIntentKey, type HomeIntentKey } from "@/lib/home-intent-tags";
import { getPlaceCategoryLabel } from "@/lib/place-trust";
import { categoryLabels, type PlaceCategory, type PlaceRankingCollection, type PlaceWithRelations } from "@/types/database";
import { useAuth } from "@/components/AuthProvider";
import { recordProductEvent } from "@/lib/place-events";

type PlacesExplorerProps = {
  places: PlaceWithRelations[];
  initialCategory?: string;
  locale?: Locale;
  loadError?: string;
  rankings: PlaceRankingCollection;
  city: PlaceCity;
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

export function PlacesExplorer({ places, initialCategory, locale = defaultLocale, loadError, rankings, city }: PlacesExplorerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => readPlacesSearchQuery(searchParams));
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [category, setCategory] = useState<PlaceCategory | "all">(
    getInitialCategory(searchParams, initialCategory),
  );
  const [region, setRegion] = useState(() => {
    const requestedRegion = searchParams.get("region");
    return cityRegions(city).some((item) => item.key === requestedRegion) ? requestedRegion as string : "all";
  });
  const [priceBucket, setPriceBucket] = useState<ChinaPriceBucket>(() => readPriceBucket(searchParams));
  const [activeChinaFilters, setActiveChinaFilters] = useState<ChinaDiscoveryFilter[]>(() => readChinaFilters(searchParams));
  const [sortMode, setSortMode] = useState<SortMode>(() => readSortMode(searchParams));
  const [homeIntent, setHomeIntent] = useState<HomeIntentKey | null>(() => readHomeIntent(searchParams));
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const copy = ui[locale];
  const explorerCopy = placesExplorerCopy[locale];
  const showChinaFilters = true;
  const hasRecommendationScores = useMemo(() => hasVerifiedRecommendationScores(places), [places]);
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
  const advancedFilterCount = activeFilterCount + (sortMode !== "verified" ? 1 : 0);
  const regions = cityRegions(city).map((item) => ({ key: item.key, label: item.labels[locale] }));
  const availableCategoryFilters = useMemo(
    () => categoryFilters.filter((filter) => filter.value === "all" || places.some((place) => place.category === filter.value)),
    [places],
  );
  const searching = query !== debouncedQuery;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!hasRecommendationScores && sortMode === "chinaRecommended") setSortMode("verified");
  }, [hasRecommendationScores, sortMode]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    nextParams.set("city", city);

    if (debouncedQuery.trim()) nextParams.set("search", debouncedQuery.trim());
    if (category !== "all") nextParams.set("category", category);
    if (region !== "all") nextParams.set("region", region);
    if (priceBucket !== "all") nextParams.set("price", priceBucket);
    if (sortMode !== "verified") nextParams.set("sort", sortMode);
    if (homeIntent) nextParams.set("intent", homeIntent);

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
  }, [activeChinaFilters, category, city, debouncedQuery, homeIntent, pathname, priceBucket, region, router, searchParams, showChinaFilters, sortMode]);

  const enrichedPlaces = useMemo(() => {
    const origin = userLocation ?? placeCityCenters[city];

    return places.map((place) => ({
      place,
      distance: typeof place.latitude === "number" && typeof place.longitude === "number"
        ? calculateDistanceMeters(origin, { latitude: place.latitude, longitude: place.longitude })
        : null,
    }));
  }, [city, places, userLocation]);

  const filteredPlaces = useMemo(() => {
    const lowered = debouncedQuery.trim().toLowerCase();
    const chinaFilteredPlaces = new Set(
      filterPlacesForChineseTraveler(
        enrichedPlaces.map((item) => item.place),
        showChinaFilters ? activeChinaFilters.filter((filter) => !timeAwareDiscoveryFilters.includes(filter)) : [],
        priceBucket,
      ).map((place) => place.id),
    );

    const filtered = enrichedPlaces
      .filter(({ place, distance }) => {
        const categoryMatch = category === "all" || place.category === category;
        const regionMatch = region === "all" || getPlaceRegion(place).region_key === region;
        const searchMatch = lowered.length === 0 || buildSearchText(place, locale).includes(lowered);
        const chinaMatch = chinaFilteredPlaces.has(place.id);
        const timeMatch = activeChinaFilters.filter((filter) => timeAwareDiscoveryFilters.includes(filter)).every((filter) => matchesTimeAwareFilter(place, filter, estimateWalkingMinutes(distance)));
        const intentMatch = !homeIntent || place.tags.some((tag) => getHomeIntentKeyFromSlug(tag.slug) === homeIntent);

        return categoryMatch && regionMatch && searchMatch && chinaMatch && timeMatch && intentMatch;
      });

    return sortPlacesForChineseTraveler(filtered, sortMode);
  }, [activeChinaFilters, category, debouncedQuery, enrichedPlaces, homeIntent, locale, priceBucket, region, showChinaFilters, sortMode]);

  const suggestedCategories = useMemo(() => {
    const counts = new Map<PlaceCategory, number>();
    places.forEach((place) => counts.set(place.category, (counts.get(place.category) ?? 0) + 1));
    return [...counts.entries()]
      .filter(([value]) => value !== category)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([value]) => value);
  }, [category, places]);

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
        homeIntent,
      },
      rawPlacesCount: places.length,
      finalFilteredCount: filteredPlaces.length,
      loadError: loadError ?? null,
    });
  }, [activeChinaFilters, category, filteredPlaces.length, homeIntent, loadError, locale, places.length, priceBucket, query, region, showChinaFilters, sortMode]);

  function toggleChinaFilter(filter: ChinaDiscoveryFilter) {
    setActiveChinaFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
    trackFilter("traveler_filter", filter);
  }

  function trackFilter(filterKind: string, filterValue: string) {
    void recordProductEvent({
      eventType: "filter_applied",
      locale,
      userId: user?.id,
      metadata: { surface: "places", city, filter_kind: filterKind, filter_value: filterValue },
    });
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setRegion("all");
    setPriceBucket("all");
    setActiveChinaFilters([]);
    setSortMode("verified");
    setHomeIntent(null);
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
            onBlur={() => { if (query.trim()) trackFilter("search", "present"); }}
            placeholder={copy.places.searchPlaceholder}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-[16px] text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-100"
              aria-label={explorerCopy.clearSearch}
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500" aria-live="polite">
          <span>{explorerCopy.resultSummary(filteredPlaces.length, places.length)}</span>
          {searching ? <span className="text-teal-700">{explorerCopy.searching}</span> : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {availableCategoryFilters.map((filter) => {
            const active = category === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => { setCategory(filter.value); trackFilter("category", filter.value); }}
                className={filterClass(active)}
              >
                {filter.value === "all" ? copy.places.all : getPlaceCategoryLabel(filter.value, locale)}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:max-w-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.region}</span>
            <select value={region} onChange={(event) => {
              const next = event.target.value;
              setRegion(next);
              trackFilter("district", next);
              if (next !== "all") void recordProductEvent({ eventType: "district_selected", locale, userId: user?.id, metadata: { city, district: next, surface: "places" } });
            }} className={selectClass}>
              <option value="all">{explorerCopy.allRegions}</option>
              {regions.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <details className="rounded-2xl bg-slate-50 ring-1 ring-slate-200" open={advancedFilterCount > 0 ? true : undefined}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black text-slate-800">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={18} aria-hidden="true" />{explorerCopy.moreFilters}</span>
            {advancedFilterCount > 0 ? <span className="rounded-full bg-teal-700 px-2.5 py-1 text-xs text-white">{explorerCopy.activeFilters} {advancedFilterCount}</span> : null}
          </summary>
          <div className="space-y-4 border-t border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.price}</span>
                <select value={priceBucket} onChange={(event) => { setPriceBucket(event.target.value as ChinaPriceBucket); trackFilter("price", event.target.value); }} className={selectClass}>
                  {chinaPriceBuckets.map((bucket) => <option key={bucket.value} value={bucket.value}>{bucket.label[locale]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.sort}</span>
                <select value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); trackFilter("sort", event.target.value); }} className={selectClass}>
                  <option value="verified">{explorerCopy.verifiedSort}</option>
                  <option value="recent">{explorerCopy.recentSort}</option>
                  {hasRecommendationScores ? <option value="chinaRecommended">{explorerCopy.recommendedSort}</option> : null}
                  <option value="saved">{explorerCopy.savedSort}</option>
                  <option value="distance" disabled={!userLocation}>{explorerCopy.distanceSort}</option>
                  <option value="lowWait">{explorerCopy.lowWaitSort}</option>
                </select>
              </label>
            </div>
            {showChinaFilters && availableQuickFilters.length ? <div>
              <p className="mb-2 text-xs font-black text-slate-500">{explorerCopy.quickFilters}</p>
              <div className="flex flex-wrap gap-2">{availableQuickFilters.map((filter) => {
                const active = activeChinaFilters.includes(filter.key);
                return <button key={filter.key} type="button" onClick={() => toggleChinaFilter(filter.key)} className="min-h-11 active:scale-95"><TagChip tone={active ? "green" : "default"}>{filter.compactLabel[locale]}</TagChip></button>;
              })}</div>
            </div> : null}
            {showChinaFilters && detailedChinaFilters.length ? <div className="flex flex-wrap gap-2">{detailedChinaFilters.map((filter) => {
              const active = activeChinaFilters.includes(filter.key);
              return <button key={filter.key} type="button" onClick={() => toggleChinaFilter(filter.key)} className="min-h-11 active:scale-95"><TagChip tone={active ? "green" : "default"}>{filter.label[locale]}</TagChip></button>;
            })}</div> : null}
            <button type="button" onClick={requestLocation} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-50 px-4 text-sm font-black text-blue-700 ring-1 ring-blue-100">
              <LocateFixed size={16} aria-hidden="true" />{explorerCopy.distanceSort}
            </button>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          {homeIntent ? <TagChip tone="green">{getHomeIntentLabel(homeIntent, locale)}</TagChip> : null}
          {activeFilterCount > 0 || query || category !== "all" || region !== "all" || homeIntent ? (
            <button type="button" onClick={clearFilters} className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-black text-white">
              {explorerCopy.clearFilters}
            </button>
          ) : null}
        </div>

        {locationMessage ? <p className="text-xs font-semibold text-slate-500">{locationMessage}</p> : null}
      </div>

      {filteredPlaces.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              loadError ? (
                <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">{explorerCopy.retry}</button>
              ) : places.length === 0 ? (
                <Link href={withLocale("/contact", locale)} className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white">{copy.common.submitPlace}</Link>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">{explorerCopy.clearFilters}</button>
                  <Link href={withLocale(`/places?city=${city}`, locale)} className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200">
                    {explorerCopy.viewAllCity}
                  </Link>
                  {suggestedCategories.map((value) => (
                    <button key={value} type="button" onClick={() => { setCategory(value); setActiveChinaFilters([]); setHomeIntent(null); }} className="min-h-11 rounded-lg bg-teal-50 px-4 py-2 text-sm font-black text-teal-800 ring-1 ring-teal-100">
                      {getPlaceCategoryLabel(value, locale)}
                    </button>
                  ))}
                  {query && process.env.NEXT_PUBLIC_SOCIAL_DISCOVERY_ENABLED === "true" ? (
                    <Link href={`${withLocale("/social-find", locale)}?text=${encodeURIComponent(query)}`} className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-black text-teal-800 ring-1 ring-teal-200">
                      {socialNoResultLabel[locale]}
                    </Link>
                  ) : null}
                </div>
              )
            }
          />
        </div>
      )}

      <PlaceRankingSection rankings={rankings} locale={locale} />

      <p className="mt-4 text-center text-xs text-slate-500">
        {explorerCopy.resultSummary(filteredPlaces.length, places.length)}
      </p>
    </div>
  );
}

const socialNoResultLabel: Record<Locale, string> = {
  ko: "SNS 단서로 다시 찾기",
  zh: "用 SNS 线索再找",
  en: "Try social clues",
  ja: "SNSの手がかりで探す",
};

const placesExplorerCopy: Record<Locale, {
  region: string;
  allRegions: string;
  price: string;
  sort: string;
  recommendedSort: string;
  verifiedSort: string;
  recentSort: string;
  savedSort: string;
  distanceSort: string;
  lowWaitSort: string;
  quickFilters: string;
  moreFilters: string;
  activeFilters: string;
  clearSearch: string;
  searching: string;
  clearFilters: string;
  viewAllCity: string;
  reduceFilters: string;
  emptyDatabaseDescription: string;
  loadErrorTitle: string;
  loadErrorDescription: string;
  retry: string;
  popular: string;
  savedBased: string;
  locationUnsupported: string;
  locationChecking: string;
  locationReady: string;
  locationDenied: string;
  resultSummary: (filtered: number, total: number) => string;
}> = {
  zh: {
    region: "区域",
    allRegions: "全部区域",
    price: "价格",
    sort: "排序",
    recommendedSort: "推荐顺序",
    verifiedSort: "已审核优先",
    recentSort: "最近确认优先",
    savedSort: "收藏顺序",
    distanceSort: "距离顺序",
    lowWaitSort: "少排队优先",
    quickFilters: "快速场景",
    moreFilters: "更多中国游客筛选",
    activeFilters: "已选",
    clearSearch: "清除搜索词",
    searching: "搜索中...",
    clearFilters: "全部清除",
    viewAllCity: "查看当前城市全部地点",
    reduceFilters: "条件稍微减少一点，可以找到更多适合的地点。",
    emptyDatabaseDescription: "目前没有已公开的地点。",
    loadErrorTitle: "无法载入地点信息",
    loadErrorDescription: "地点数据库查询失败。请稍后再试。",
    retry: "重新加载",
    popular: "热门地点",
    savedBased: "按收藏数",
    locationUnsupported: "此浏览器无法使用当前位置。",
    locationChecking: "正在确认当前位置...",
    locationReady: "可以按当前位置距离排序。",
    locationDenied: "位置权限被拒绝。仍可继续使用其他搜索功能。",
    resultSummary: (filtered, total) => `显示 ${filtered} / 公开 ${total}`,
  },
  en: {
    region: "Region",
    allRegions: "All regions",
    price: "Price",
    sort: "Sort",
    recommendedSort: "Recommended",
    verifiedSort: "Verified first",
    recentSort: "Recently checked",
    savedSort: "Most saved",
    distanceSort: "Distance",
    lowWaitSort: "Short wait",
    quickFilters: "Quick filters",
    moreFilters: "More traveler filters",
    activeFilters: "Active",
    clearSearch: "Clear search",
    searching: "Searching...",
    clearFilters: "Reset filters",
    viewAllCity: "View all places in this city",
    reduceFilters: "Try removing a few filters to see more places.",
    emptyDatabaseDescription: "There are no published places yet.",
    loadErrorTitle: "Could not load places",
    loadErrorDescription: "The place database query failed. Please try again later.",
    retry: "Reload",
    popular: "Popular places",
    savedBased: "Based on saves",
    locationUnsupported: "Current location is unavailable in this browser.",
    locationChecking: "Checking your current location...",
    locationReady: "Distance sorting is available from your current location.",
    locationDenied: "Location permission was denied. Other search features remain available.",
    resultSummary: (filtered, total) => `Showing ${filtered} of ${total} public places`,
  },
  ja: {
    region: "エリア",
    allRegions: "すべてのエリア",
    price: "価格",
    sort: "並び替え",
    recommendedSort: "おすすめ順",
    verifiedSort: "確認済み順",
    recentSort: "最近確認順",
    savedSort: "保存順",
    distanceSort: "距離順",
    lowWaitSort: "待ち時間が短い順",
    quickFilters: "クイック条件",
    moreFilters: "旅行者向け条件",
    activeFilters: "選択中",
    clearSearch: "検索語を消去",
    searching: "検索中...",
    clearFilters: "リセット",
    viewAllCity: "この都市の全スポットを見る",
    reduceFilters: "条件を少し減らすと、より多くのスポットが見つかります。",
    emptyDatabaseDescription: "公開済みスポットがまだありません。",
    loadErrorTitle: "スポット情報を読み込めません",
    loadErrorDescription: "スポットデータベースの取得に失敗しました。時間をおいて再確認してください。",
    retry: "再読み込み",
    popular: "人気スポット",
    savedBased: "保存数基準",
    locationUnsupported: "このブラウザでは現在地を使用できません。",
    locationChecking: "現在地を確認しています...",
    locationReady: "現在地から距離順で並び替えできます。",
    locationDenied: "位置情報の権限が拒否されました。他の検索機能は利用できます。",
    resultSummary: (filtered, total) => `公開 ${total} 件中 ${filtered} 件を表示`,
  },
  ko: {
    region: "지역",
    allRegions: "전체 지역",
    price: "가격대",
    sort: "정렬",
    recommendedSort: "추천순",
    verifiedSort: "검수 완료순",
    recentSort: "최근 확인순",
    savedSort: "저장순",
    distanceSort: "거리순",
    lowWaitSort: "대기 적은 순",
    quickFilters: "빠른 상황 필터",
    moreFilters: "여행자 상세 필터",
    activeFilters: "적용",
    clearSearch: "검색어 지우기",
    searching: "검색 중...",
    clearFilters: "전체 초기화",
    viewAllCity: "이 도시 전체 보기",
    reduceFilters: "조건을 조금 줄이면 더 많은 장소를 찾을 수 있어요.",
    emptyDatabaseDescription: "아직 공개된 장소가 없습니다.",
    loadErrorTitle: "장소 정보를 불러오지 못했습니다",
    loadErrorDescription: "장소 데이터베이스 조회에 실패했습니다. 잠시 후 다시 확인해 주세요.",
    retry: "다시 불러오기",
    popular: "인기 장소",
    savedBased: "저장 수 기반",
    locationUnsupported: "이 브라우저에서는 현재 위치를 사용할 수 없습니다.",
    locationChecking: "현재 위치를 확인하는 중입니다...",
    locationReady: "현재 위치 기준 거리순 정렬을 사용할 수 있습니다.",
    locationDenied: "위치 권한이 거부되었습니다. 다른 검색 기능은 계속 사용할 수 있습니다.",
    resultSummary: (filtered, total) => `공개 ${total}곳 중 ${filtered}곳 표시`,
  },
};

function buildSearchText(place: PlaceWithRelations, locale: Locale) {
  const content = getPlaceContent(place, locale);
  const { city, region_key } = getPlaceRegion(place);
  const cityLabel = placeCities.find((option) => option.key === city)?.label;

  return [
    city ? `${cityLabel} ${placeRegionLabel(city, region_key, place.address_ko)}` : "",
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

function filterClass(active: boolean) {
  return cn(
    "min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
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

  return value === "verified" || value === "recent" || value === "chinaRecommended" || value === "saved" || value === "distance" || value === "lowWait" ? value : "verified";
}

function readHomeIntent(searchParams: URLSearchParams): HomeIntentKey | null {
  const value = searchParams.get("intent");
  return isHomeIntentKey(value) ? value : null;
}
