"use client";

import { useState } from "react";
import { ExternalLink, LocateFixed, MapPin, Navigation } from "lucide-react";
import { TagChip } from "@/components/TagChip";
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  formatDistance,
  getOpeningStatus,
  getOpeningStatusLabel,
  type Coordinates,
} from "@/lib/location";
import type { PlaceWithRelations } from "@/types/database";

type PlaceLocationPanelProps = {
  place: PlaceWithRelations;
};

export function PlaceLocationPanel({ place }: PlaceLocationPanelProps) {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [message, setMessage] = useState("현재 위치를 허용하면 이 장소까지의 거리를 계산합니다.");

  const hasCoordinate = typeof place.latitude === "number" && typeof place.longitude === "number";
  const placeCoordinate = hasCoordinate
    ? {
        latitude: place.latitude as number,
        longitude: place.longitude as number,
      }
    : null;
  const distance = userLocation && placeCoordinate ? calculateDistanceMeters(userLocation, placeCoordinate) : null;
  const walkingMinutes = estimateWalkingMinutes(distance);
  const openingStatus = getOpeningStatus(place.opening_hours);
  const openingLabel = getOpeningStatusLabel(openingStatus);
  const mapUrl = hasCoordinate
    ? `https://map.kakao.com/link/map/${encodeURIComponent(place.name_ko)},${place.latitude},${place.longitude}`
    : `https://map.kakao.com/?q=${encodeURIComponent(place.name_ko)}`;

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setMessage("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }

    setMessage("현재 위치를 확인하는 중입니다...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setMessage("현재 위치 기준 거리입니다.");
      },
      () => {
        setMessage("위치 권한이 거부되었습니다. 장소 정보는 계속 볼 수 있습니다.");
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
          <h2 className="text-xl font-black text-slate-950">位置</h2>
          <p className="mt-1 text-sm text-slate-500">위치와 이동 시간</p>
        </div>
        <TagChip tone={openingLabel.tone}>{openingLabel.zh}</TagChip>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <Navigation size={17} className="text-teal-700" aria-hidden="true" />
          <p className="mt-2 text-xs text-slate-500">距离你</p>
          <p className="text-lg font-black text-slate-950">{distance === null ? "待确认" : formatDistance(distance)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <MapPin size={17} className="text-teal-700" aria-hidden="true" />
          <p className="mt-2 text-xs text-slate-500">步行约</p>
          <p className="text-lg font-black text-slate-950">{walkingMinutes === null ? `${place.walking_minutes}分钟` : `${walkingMinutes}分钟`}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={requestLocation}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95"
        >
          <LocateFixed size={18} aria-hidden="true" />
          거리 계산
        </button>
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
        >
          <ExternalLink size={18} aria-hidden="true" />
          打开地图
        </a>
      </div>
    </section>
  );
}
