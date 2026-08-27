"use client";

import Image from "next/image";
import Link from "next/link";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, LocateFixed, MapPinned, Navigation, Search } from "lucide-react";
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
  mapCategories,
  type Coordinates,
} from "@/lib/location";
import { cn } from "@/lib/utils";
import { defaultLocale, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { getPreferredMapProvider, type MapBounds, type MapMarker } from "@/lib/map-provider";
import { categoryLabels, type PlaceCategory, type PlaceWithRelations } from "@/types/database";

type NearbyExplorerProps = {
  places: PlaceWithRelations[];
  locale?: Locale;
};

type OriginMode = "current" | "gwangalli";

type PlaceListItem = {
  place: PlaceWithRelations;
  distance: number | null;
  walkingMinutes: number | null;
  openingStatus: ReturnType<typeof getOpeningStatus>;
};

const categoryOptions: Array<{ value: PlaceCategory | "all"; short: Record<Locale, string> }> = [
  { value: "all", short: { zh: "全部", en: "All", ja: "すべて", ko: "전체" } },
  { value: "restaurant", short: categoryLabels.restaurant },
  { value: "cafe", short: categoryLabels.cafe },
  { value: "attraction", short: categoryLabels.attraction },
  { value: "shopping", short: categoryLabels.shopping },
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

export function NearbyExplorer({ places, locale = defaultLocale }: NearbyExplorerProps) {
  const localizedCopy = nearbyCopy[locale];
  const [originMode, setOriginMode] = useState<OriginMode>("gwangalli");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState(localizedCopy.gwangalliBase);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; sequence: number } | null>(null);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [appliedBounds, setAppliedBounds] = useState<MapBounds | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement | null>());
  const origin = originMode === "current" && userLocation ? userLocation : gwangalliCenter;
  const provider = getPreferredMapProvider();
  const copy = ui[locale];

  const baseItems = useMemo(() => {
    return places
      .filter((place) => mapCategories.includes(place.category))
      .filter((place) => typeof place.latitude === "number" && typeof place.longitude === "number")
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

    return baseItems
      .filter((item) => {
        const content = getPlaceContent(item.place, locale);
        const categoryMatch = category === "all" || item.place.category === category;
        const boundsMatch = isInsideBounds(item.place, appliedBounds);
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
        ]
          .join(" ")
          .toLowerCase();
        const searchMatch = lowered.length === 0 || searchText.includes(lowered);

        return categoryMatch && boundsMatch && searchMatch;
      })
      .sort((a, b) => {
        const statusRank = { open: 0, closing_soon: 1, unknown: 2, closed: 3 };
        const statusDiff = statusRank[a.openingStatus] - statusRank[b.openingStatus];

        if (statusDiff !== 0) {
          return statusDiff;
        }

        return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER);
      });
  }, [appliedBounds, baseItems, category, locale, query]);

  const markers: MapMarker[] = useMemo(() => {
    return filteredItems.map(({ place, distance, walkingMinutes }) => {
      const content = getPlaceContent(place, locale);

      return {
        id: place.id,
        title: content.name,
        subtitle: content.secondaryName,
        category: place.category,
        position: {
          latitude: place.latitude as number,
          longitude: place.longitude as number,
        },
        href: withLocale(`/places/${place.slug}`, locale),
        imageUrl: place.thumbnail_url,
        meta: `${formatDistance(distance)} · ${copy.placeDetail.walkingApprox} ${walkingMinutes ?? place.walking_minutes}${copy.common.minutes}`,
        saveCount: place.save_count ?? 0,
      };
    });
  }, [copy.common.minutes, copy.placeDetail.walkingApprox, filteredItems, locale]);

  const selectedItem = useMemo(() => {
    return filteredItems.find((item) => item.place.id === selectedId) ?? filteredItems[0] ?? null;
  }, [filteredItems, selectedId]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedId(null);
      return;
    }

    if (selectedId !== selectedItem.place.id) {
      setSelectedId(selectedItem.place.id);
    }
  }, [selectedId, selectedItem]);

  function selectPlace(placeId: string, source: "card" | "marker") {
    setSelectedId(placeId);
    setFocusRequest((current) => ({ id: placeId, sequence: (current?.sequence ?? 0) + 1 }));

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

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus(localizedCopy.locationUnsupported);
      setOriginMode("gwangalli");
      return;
    }

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
        setLocationStatus(`${localizedCopy.currentBase} ${localizedCopy.distanceToGwangalli} ${formatDistance(distanceToGwangalli)}.`);
      },
      () => {
        setOriginMode("gwangalli");
        setLocationStatus(localizedCopy.locationDenied);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    );
  }

  const searchControls = (
    <SearchAndFilters
      query={query}
      category={category}
      locale={locale}
      appliedBounds={appliedBounds}
      onQueryChange={setQuery}
      onCategoryChange={setCategory}
      onClearArea={clearAreaSearch}
      onRequestLocation={requestLocation}
      originMode={originMode}
      locationStatus={locationStatus}
      canUseCurrentLocation={Boolean(userLocation)}
      onOriginModeChange={setOriginMode}
    />
  );

  const list = (
    <PlaceResultList
      items={filteredItems}
      selectedId={selectedItem?.place.id ?? null}
      locale={locale}
      cardRefs={cardRefs}
      onSelect={(id) => selectPlace(id, "card")}
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
            provider={provider}
            locale={locale}
            selectedId={selectedItem?.place.id ?? null}
            focusRequest={focusRequest}
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
            provider={provider}
            locale={locale}
            selectedId={selectedItem?.place.id ?? null}
            focusRequest={focusRequest}
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
  originMode,
  canUseCurrentLocation,
  onQueryChange,
  onCategoryChange,
  onClearArea,
  onRequestLocation,
  onOriginModeChange,
}: {
  query: string;
  category: PlaceCategory | "all";
  locale: Locale;
  appliedBounds: MapBounds | null;
  locationStatus: string;
  originMode: OriginMode;
  canUseCurrentLocation: boolean;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: PlaceCategory | "all") => void;
  onClearArea: () => void;
  onRequestLocation: () => void;
  onOriginModeChange: (value: OriginMode) => void;
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

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOriginModeChange("current")}
          disabled={!canUseCurrentLocation}
          className={cn(
            "h-11 rounded-2xl text-sm font-black ring-1 transition active:scale-95 disabled:opacity-50",
            originMode === "current" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
          )}
        >
          {localizedCopy.currentLocation}
        </button>
        <button
          type="button"
          onClick={onRequestLocation}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-3 text-sm font-black text-white transition active:scale-95"
        >
          <LocateFixed size={17} aria-hidden="true" />
          {localizedCopy.useMyLocation}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categoryOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onCategoryChange(option.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
              category === option.value ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
            )}
          >
            {option.short[locale]}
          </button>
        ))}
      </div>

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
  cardRefs,
  onSelect,
}: {
  items: PlaceListItem[];
  selectedId: string | null;
  locale: Locale;
  cardRefs: MutableRefObject<Map<string, HTMLDivElement | null>>;
  onSelect: (id: string) => void;
}) {
  const copy = nearbyCopy[locale];

  if (items.length === 0) {
    return <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />;
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
          </span>
        </span>
      </button>
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
        </Link>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
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
  detail: string;
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
    emptyDescription: "移动地图或减少筛选条件后再试。",
    detail: "详情",
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
    detail: "Details",
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
    detail: "詳細",
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
    detail: "상세",
  },
};
