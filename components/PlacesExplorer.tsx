"use client";

import { useMemo, useState } from "react";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { TagChip } from "@/components/TagChip";
import {
  calculateDistanceMeters,
  formatDistance,
  formatOpeningStatus,
  getOpeningStatus,
  type Coordinates,
} from "@/lib/location";
import { cn } from "@/lib/utils";
import { defaultLocale, getPlaceContent, type Locale, ui } from "@/lib/i18n";
import { categoryLabels, type PlaceCategory, type PlaceWithRelations } from "@/types/database";

type PlacesExplorerProps = {
  places: PlaceWithRelations[];
  initialCategory?: string;
  locale?: Locale;
};

type ExtraFilter = "openNow" | "solo" | "cardPayment";
type SortMode = "recommended" | "saved" | "distance";
type PriceBucket = "all" | "free" | "under10000" | "under20000" | "over20000";

const categoryFilters: Array<{ value: PlaceCategory | "all" }> = [
  { value: "all" },
  { value: "restaurant" },
  { value: "cafe" },
  { value: "attraction" },
  { value: "shopping" },
];

const extraFilters: Array<{ key: ExtraFilter; label: Record<Locale, string>; enabled: (places: PlaceWithRelations[]) => boolean }> = [
  {
    key: "openNow",
    label: { zh: "营业中", en: "Open now", ja: "営業中", ko: "영업중" },
    enabled: (places) => places.some((place) => Boolean(place.opening_hours)),
  },
  {
    key: "solo",
    label: { zh: "一个人也可以", en: "Solo friendly", ja: "一人でもOK", ko: "혼밥 가능" },
    enabled: (places) => places.some((place) => place.solo_friendly),
  },
  {
    key: "cardPayment",
    label: { zh: "可以刷卡", en: "Card accepted", ja: "カード可", ko: "카드결제" },
    enabled: (places) => places.some((place) => place.card_payment),
  },
];

const priceBuckets: Array<{ value: PriceBucket; label: Record<Locale, string>; match: (place: PlaceWithRelations) => boolean }> = [
  { value: "all", label: { zh: "全部价格", en: "Any price", ja: "すべて", ko: "전체 가격" }, match: () => true },
  { value: "free", label: { zh: "免费", en: "Free", ja: "無料", ko: "무료" }, match: (place) => place.price_min === 0 && place.price_max === 0 },
  { value: "under10000", label: { zh: "₩10,000 以下", en: "Under ₩10,000", ja: "₩10,000以下", ko: "1만원 이하" }, match: (place) => maxKnownPrice(place) !== null && (maxKnownPrice(place) ?? 0) <= 10000 },
  { value: "under20000", label: { zh: "₩20,000 以下", en: "Under ₩20,000", ja: "₩20,000以下", ko: "2만원 이하" }, match: (place) => maxKnownPrice(place) !== null && (maxKnownPrice(place) ?? 0) <= 20000 },
  { value: "over20000", label: { zh: "₩20,000+", en: "₩20,000+", ja: "₩20,000+", ko: "2만원 이상" }, match: (place) => maxKnownPrice(place) !== null && (maxKnownPrice(place) ?? 0) > 20000 },
];

export function PlacesExplorer({ places, initialCategory, locale = defaultLocale }: PlacesExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "all">(
    categoryFilters.some((filter) => filter.value === initialCategory) ? (initialCategory as PlaceCategory) : "all",
  );
  const [region, setRegion] = useState("all");
  const [priceBucket, setPriceBucket] = useState<PriceBucket>("all");
  const [activeExtras, setActiveExtras] = useState<ExtraFilter[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const copy = ui[locale];
  const explorerCopy = placesExplorerCopy[locale];
  const availableExtras = useMemo(() => extraFilters.filter((filter) => filter.enabled(places)), [places]);
  const availablePriceBuckets = useMemo(() => priceBuckets.filter((bucket) => bucket.value === "all" || places.some(bucket.match)), [places]);
  const regions = useMemo(() => buildRegions(places), [places]);

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
    const price = availablePriceBuckets.find((bucket) => bucket.value === priceBucket) ?? priceBuckets[0];

    return enrichedPlaces
      .filter(({ place }) => {
        const categoryMatch = category === "all" || place.category === category;
        const regionMatch = region === "all" || getRegionKey(place) === region;
        const priceMatch = price.match(place);
        const searchMatch = lowered.length === 0 || buildSearchText(place, locale).includes(lowered);
        const extraMatch = activeExtras.every((filter) => {
          if (filter === "openNow") {
            return getOpeningStatus(place.opening_hours) === "open" || getOpeningStatus(place.opening_hours) === "closing_soon";
          }

          if (filter === "solo") {
            return place.solo_friendly;
          }

          return place.card_payment;
        });

        return categoryMatch && regionMatch && priceMatch && searchMatch && extraMatch;
      })
      .sort((a, b) => {
        if (sortMode === "saved") {
          return (b.place.save_count ?? 0) - (a.place.save_count ?? 0);
        }

        if (sortMode === "distance") {
          return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER);
        }

        if (a.place.is_featured !== b.place.is_featured) {
          return a.place.is_featured ? -1 : 1;
        }

        return (b.place.save_count ?? 0) - (a.place.save_count ?? 0);
      });
  }, [activeExtras, availablePriceBuckets, category, enrichedPlaces, locale, priceBucket, query, region, sortMode]);

  const popularPlaces = useMemo(() => {
    return [...places]
      .filter((place) => (place.save_count ?? 0) > 0)
      .sort((a, b) => (b.save_count ?? 0) - (a.save_count ?? 0))
      .slice(0, 4);
  }, [places]);

  function toggleExtra(filter: ExtraFilter) {
    setActiveExtras((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
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
            <select value={priceBucket} onChange={(event) => setPriceBucket(event.target.value as PriceBucket)} className={selectClass}>
              {availablePriceBuckets.map((bucket) => (
                <option key={bucket.value} value={bucket.value}>{bucket.label[locale]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-black text-slate-500">{explorerCopy.sort}</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={selectClass}>
              <option value="recommended">{explorerCopy.recommendedSort}</option>
              <option value="saved">{explorerCopy.savedSort}</option>
              <option value="distance" disabled={!userLocation}>{explorerCopy.distanceSort}</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableExtras.map((filter) => {
            const active = activeExtras.includes(filter.key);

            return (
              <button key={filter.key} type="button" onClick={() => toggleExtra(filter.key)} className="active:scale-95">
                <TagChip tone={active ? "green" : "default"}>{filter.label[locale]}</TagChip>
              </button>
            );
          })}
          <button type="button" onClick={requestLocation} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-700 ring-1 ring-blue-100">
            <LocateFixed size={14} aria-hidden="true" />
            {explorerCopy.distanceSort}
          </button>
        </div>

        {locationMessage ? <p className="text-xs font-semibold text-slate-500">{locationMessage}</p> : null}
      </div>

      {popularPlaces.length > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">{explorerCopy.popular}</h2>
              <p className="mt-1 text-xs text-slate-500">{explorerCopy.savedBased}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {popularPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} locale={locale} compact />
            ))}
          </div>
        </section>
      ) : null}

      {filteredPlaces.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {filteredPlaces.map(({ place, distance }, index) => (
            <PlaceCard key={place.id} place={place} priority={index === 0} locale={locale} distanceMeters={distance} />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title={copy.places.emptyTitle} description={copy.places.emptyDescription} />
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

function maxKnownPrice(place: PlaceWithRelations) {
  if (place.price_max !== null) {
    return place.price_max;
  }

  return place.price_min;
}

function filterClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
    active ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
  );
}

const selectClass = "h-11 w-full rounded-2xl bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none ring-1 ring-slate-200";
