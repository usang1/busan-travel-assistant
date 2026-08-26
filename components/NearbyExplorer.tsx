"use client";

import { useMemo, useState } from "react";
import { LocateFixed, MapPinned, Navigation, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { TagChip } from "@/components/TagChip";
import { TravelMap } from "@/components/TravelMap";
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
  getOpeningStatus,
  getOpeningStatusLabel,
  getPlaceDistance,
  gwangalliCenter,
  mapCategories,
  type Coordinates,
} from "@/lib/location";
import { defaultLocale, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { getPreferredMapProvider, type MapMarker } from "@/lib/map-provider";
import type { PlaceCategory, PlaceWithRelations } from "@/types/database";

type NearbyExplorerProps = {
  places: PlaceWithRelations[];
  locale?: Locale;
};

type OriginMode = "current" | "gwangalli";

const radiusOptions = [
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
  { label: "2km", value: 2000 },
];

const categoryOptions: Array<{ label: string; ko: string; value: PlaceCategory | "all" }> = [
  { label: "全部", ko: "전체", value: "all" },
  { label: "吃饭", ko: "식사", value: "restaurant" },
  { label: "咖啡", ko: "카페", value: "cafe" },
  { label: "拍照", ko: "사진", value: "photo_spot" },
  { label: "景点", ko: "관광", value: "attraction" },
  { label: "购物", ko: "쇼핑", value: "shopping" },
  { label: "行李", ko: "짐보관", value: "luggage" },
];

export function NearbyExplorer({ places, locale = defaultLocale }: NearbyExplorerProps) {
  const [originMode, setOriginMode] = useState<OriginMode>("gwangalli");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState("广安里 기준으로 표시 중입니다.");
  const [radius, setRadius] = useState(1000);
  const [category, setCategory] = useState<PlaceCategory | "all">("all");

  const origin = originMode === "current" && userLocation ? userLocation : gwangalliCenter;
  const provider = getPreferredMapProvider();
  const copy = ui[locale];

  const nearbyPlaces = useMemo(() => {
    return places
      .filter((place) => mapCategories.includes(place.category))
      .map((place) => {
        const distance = getPlaceDistance(place, origin);
        const status = getOpeningStatus(place.opening_hours);

        return {
          place,
          distance,
          walkingMinutes: estimateWalkingMinutes(distance),
          openingStatus: status,
        };
      })
      .filter((item) => {
        const radiusMatch = item.distance !== null && item.distance <= radius;
        const categoryMatch = category === "all" || item.place.category === category;

        return radiusMatch && categoryMatch;
      })
      .sort((a, b) => {
        const statusRank = { open: 0, closing_soon: 1, unknown: 2, closed: 3 };
        const statusDiff = statusRank[a.openingStatus] - statusRank[b.openingStatus];

        if (statusDiff !== 0) {
          return statusDiff;
        }

        return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER);
      });
  }, [category, origin, places, radius]);

  const markers: MapMarker[] = nearbyPlaces.map(({ place, distance, walkingMinutes }) => {
    const content = getPlaceContent(place, locale);

    return {
      id: place.id,
      title: content.name,
      subtitle: content.secondaryName,
      category: place.category,
      position: {
        latitude: place.latitude ?? gwangalliCenter.latitude,
        longitude: place.longitude ?? gwangalliCenter.longitude,
      },
      href: withLocale(`/places/${place.slug}`, locale),
      imageUrl: place.thumbnail_url,
      meta: `${formatDistance(distance)} · ${copy.placeDetail.walkingApprox} ${walkingMinutes ?? place.walking_minutes}${copy.common.minutes}`,
    };
  });

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("이 브라우저에서는 현재 위치를 사용할 수 없습니다. 广安里 기준으로 계속 사용할 수 있습니다.");
      setOriginMode("gwangalli");
      return;
    }

    setLocationStatus("현재 위치를 확인하는 중입니다...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const distanceToGwangalli = calculateDistanceMeters(nextLocation, gwangalliCenter);

        setUserLocation(nextLocation);
        setOriginMode("current");
        setLocationStatus(`현재 위치 기준입니다. 광안리 중심까지 ${formatDistance(distanceToGwangalli)}.`);
      },
      () => {
        setOriginMode("gwangalli");
        setLocationStatus("위치 권한이 거부되었습니다. 사이트는 广安里 기준으로 계속 사용할 수 있습니다.");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10">
          <MapPinned size={16} aria-hidden="true" />
          当前位置 / 广安里
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">现在附近去哪？</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">현재 위치 또는 광안리 중심에서 가까운 장소를 거리순으로 찾습니다.</p>
        <button
          type="button"
          onClick={requestLocation}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-4 text-base font-black text-white transition active:scale-[0.98]"
        >
          <LocateFixed size={20} aria-hidden="true" />
          查看我附近
          <span className="text-sm font-semibold text-teal-50">내 주변 보기</span>
        </button>
        <p className="mt-3 text-xs leading-5 text-slate-300">{locationStatus}</p>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOriginMode("current")}
            disabled={!userLocation}
            className={[
              "h-12 rounded-2xl text-sm font-black ring-1 transition active:scale-95 disabled:opacity-50",
              originMode === "current" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
            ].join(" ")}
          >
            当前位置
          </button>
          <button
            type="button"
            onClick={() => setOriginMode("gwangalli")}
            className={[
              "h-12 rounded-2xl text-sm font-black ring-1 transition active:scale-95",
              originMode === "gwangalli" ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
            ].join(" ")}
          >
            广安里
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {radiusOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRadius(option.value)}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 transition active:scale-95",
                radius === option.value ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-slate-200",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
            <SlidersHorizontal size={18} aria-hidden="true" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategory(option.value)}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition active:scale-95",
                category === option.value ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
              ].join(" ")}
            >
              {option.label}
              <span className="ml-1 text-xs opacity-70">{option.ko}</span>
            </button>
          ))}
        </div>
      </section>

      <TravelMap center={origin} markers={markers} userLocation={originMode === "current" ? userLocation : null} provider={provider} />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">现在可以去</h2>
            <p className="mt-1 text-sm text-slate-500">지금 갈 수 있어요 · {formatDistance(radius)} 이내</p>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-bold text-teal-700">
            <Navigation size={14} aria-hidden="true" />
            거리순
          </div>
        </div>

        {nearbyPlaces.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {nearbyPlaces.map(({ place, distance, walkingMinutes, openingStatus }, index) => {
              const label = getOpeningStatusLabel(openingStatus);

              return (
                <div key={place.id} className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <TagChip tone={label.tone}>{label.zh}</TagChip>
                    <TagChip tone="blue">
                      {formatDistance(distance)} · 步行约 {walkingMinutes ?? place.walking_minutes}分钟
                    </TagChip>
                  </div>
                  <PlaceCard place={place} priority={index === 0} locale={locale} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="附近没有符合条件的地点" description="거리 범위를 넓히거나 카테고리 필터를 바꿔 주세요." />
        )}
      </section>
    </div>
  );
}
