"use client";

import { useState } from "react";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { TagChip } from "@/components/TagChip";
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
  formatOpeningStatus,
  hasCoordinates,
  type Coordinates,
} from "@/lib/location";
import { defaultLocale, getPlaceContent, type Locale, ui } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

type PlaceLocationPanelProps = {
  place: PlaceWithRelations;
  locale?: Locale;
};

const locationCopy: Record<Locale, {
  title: string;
  subtitle: string;
  allowLocation: string;
  noCoordinates: string;
  unsupported: string;
  checking: string;
  ready: string;
  denied: string;
}> = {
  zh: { title: "位置", subtitle: "距离和移动时间", allowLocation: "允许当前位置后可计算到此处的距离。", noCoordinates: "此地点坐标仍需确认，暂时无法计算距离。", unsupported: "此浏览器无法使用当前位置。", checking: "正在确认当前位置...", ready: "当前显示你所在位置的距离。", denied: "位置权限被拒绝。仍可查看地点信息。" },
  en: { title: "Location", subtitle: "Distance and travel time", allowLocation: "Allow current location to calculate the distance to this place.", noCoordinates: "Coordinates for this place need checking, so distance cannot be calculated yet.", unsupported: "Current location is unavailable in this browser.", checking: "Checking your current location...", ready: "Distance is now based on your current location.", denied: "Location permission was denied. Place details remain available." },
  ja: { title: "位置", subtitle: "距離と移動時間", allowLocation: "現在地を許可すると、この場所までの距離を計算できます。", noCoordinates: "このスポットの座標は確認中のため、距離はまだ計算できません。", unsupported: "このブラウザでは現在地を使用できません。", checking: "現在地を確認しています...", ready: "現在地からの距離を表示しています。", denied: "位置情報の権限が拒否されました。スポット情報は引き続き確認できます。" },
  ko: { title: "위치", subtitle: "거리와 이동 시간", allowLocation: "현재 위치를 허용하면 이 장소까지의 거리를 계산합니다.", noCoordinates: "이 장소의 좌표 확인이 필요해 아직 거리를 계산할 수 없습니다.", unsupported: "이 브라우저에서는 현재 위치를 사용할 수 없습니다.", checking: "현재 위치를 확인하는 중입니다...", ready: "현재 위치 기준 거리입니다.", denied: "위치 권한이 거부되었습니다. 장소 정보는 계속 볼 수 있습니다." },
};

export function PlaceLocationPanel({ place, locale = defaultLocale }: PlaceLocationPanelProps) {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const content = getPlaceContent(place, locale);
  const copy = ui[locale];
  const text = locationCopy[locale];

  const placeCoordinate = hasCoordinates(place)
    ? {
        latitude: place.latitude,
        longitude: place.longitude,
      }
    : null;
  const distance = userLocation && placeCoordinate ? calculateDistanceMeters(userLocation, placeCoordinate) : null;
  const walkingMinutes = estimateWalkingMinutes(distance);
  const walkingValue = walkingMinutes !== null
    ? `${walkingMinutes}${copy.common.minutes}`
    : placeCoordinate && place.walking_minutes > 0
      ? `${place.walking_minutes}${copy.common.minutes}`
      : copy.common.noInfo;
  const opening = formatOpeningStatus(place.opening_hours, locale);
  const message = statusMessage || (placeCoordinate ? (userLocation ? text.ready : text.allowLocation) : text.noCoordinates);

  function requestLocation() {
    if (!placeCoordinate) {
      return;
    }

    if (!("geolocation" in navigator)) {
      setUserLocation(null);
      setStatusMessage(text.unsupported);
      return;
    }

    setStatusMessage(text.checking);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setStatusMessage(text.ready);
      },
      () => {
        setUserLocation(null);
        setStatusMessage(text.denied);
        window.dispatchEvent(new CustomEvent("map-location-denied"));
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      },
    );
  }

  return (
    <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">{text.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.subtitle}</p>
        </div>
        <TagChip tone={opening.tone}>{opening.text}</TagChip>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <Navigation size={17} className="text-teal-700" aria-hidden="true" />
          <p className="mt-2 text-xs text-slate-500">{copy.placeDetail.distanceFromYou}</p>
          <p className="text-lg font-black text-slate-950">{distance === null ? copy.common.noInfo : formatDistance(distance, locale)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <MapPin size={17} className="text-teal-700" aria-hidden="true" />
          <p className="mt-2 text-xs text-slate-500">{copy.placeDetail.walkingApprox}</p>
          <p className="text-lg font-black text-slate-950">{walkingValue}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={requestLocation}
          disabled={!placeCoordinate}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LocateFixed size={18} aria-hidden="true" />
          {copy.placeDetail.calculateDistance}
        </button>
        <DirectionsButton
          placeId={place.id}
          name={content.name}
          address={content.address}
          coordinates={placeCoordinate}
          locale={locale}
          className="w-full justify-end"
        />
      </div>
    </section>
  );
}
