"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Navigation } from "lucide-react";
import { useMemo, useState } from "react";
import { SaveButton } from "@/components/SaveButton";
import { categoryLabels } from "@/types/database";
import type { Coordinates } from "@/lib/location";
import type { MapMarker, TravelMapProvider } from "@/lib/map-provider";

type TravelMapProps = {
  center: Coordinates;
  markers: MapMarker[];
  userLocation?: Coordinates | null;
  provider: TravelMapProvider;
};

const markerColor: Record<MapMarker["category"], string> = {
  restaurant: "bg-rose-600",
  cafe: "bg-amber-600",
  bar: "bg-violet-600",
  attraction: "bg-sky-600",
  shopping: "bg-fuchsia-600",
  photo_spot: "bg-cyan-600",
  luggage: "bg-slate-800",
};

export function TravelMap({ center, markers, userLocation, provider }: TravelMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(markers[0]?.id ?? null);
  const selected = markers.find((marker) => marker.id === selectedId) ?? markers[0] ?? null;

  const bounds = useMemo(() => {
    const coordinates = [
      center,
      ...markers.map((marker) => marker.position),
      ...(userLocation ? [userLocation] : []),
    ];
    const latitudes = coordinates.map((coordinate) => coordinate.latitude);
    const longitudes = coordinates.map((coordinate) => coordinate.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    return {
      minLat: minLat === maxLat ? minLat - 0.002 : minLat,
      maxLat: minLat === maxLat ? maxLat + 0.002 : maxLat,
      minLng: minLng === maxLng ? minLng - 0.002 : minLng,
      maxLng: minLng === maxLng ? maxLng + 0.002 : maxLng,
    };
  }, [center, markers, userLocation]);

  function toPoint(position: Coordinates) {
    const x = ((position.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 82 + 9;
    const y = (1 - (position.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 72 + 14;

    return {
      left: `${Math.min(94, Math.max(6, x))}%`,
      top: `${Math.min(88, Math.max(10, y))}%`,
    };
  }

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-black text-slate-950">地图</p>
          <p className="text-xs text-slate-500">
            {provider.label} · {provider.id === "fallback" ? "API key 없이 fallback 표시" : "provider adapter"}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
          <Navigation size={13} aria-hidden="true" />
          {markers.length} markers
        </div>
      </div>

      <div className="relative h-[360px] bg-[linear-gradient(135deg,#dff7f0_0%,#edf7ff_52%,#f8fafc_100%)]">
        <div className="absolute inset-x-0 top-1/2 h-20 -translate-y-1/2 bg-sky-200/70" />
        <div className="absolute left-0 top-[52%] h-2 w-full -rotate-6 bg-white/80" />
        <div className="absolute left-0 top-[37%] h-2 w-full rotate-3 bg-white/70" />
        <div className="absolute inset-6 rounded-[28px] border border-white/70" />

        {userLocation ? (
          <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={toPoint(userLocation)}>
            <div className="grid size-9 place-items-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-blue-100">
              <Navigation size={17} aria-hidden="true" />
            </div>
            <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-1 text-[11px] font-bold text-blue-700 shadow-sm">
              我
            </span>
          </div>
        ) : null}

        {markers.map((marker) => {
          const point = toPoint(marker.position);
          const active = marker.id === selected?.id;

          return (
            <button
              key={marker.id}
              type="button"
              onClick={() => setSelectedId(marker.id)}
              className="absolute z-10 -translate-x-1/2 -translate-y-full transition active:scale-95"
              style={point}
              aria-label={marker.title}
            >
              <span
                className={[
                  "grid size-10 place-items-center rounded-full text-white shadow-lg ring-4",
                  markerColor[marker.category],
                  active ? "ring-teal-200" : "ring-white/80",
                ].join(" ")}
              >
                <MapPin size={19} fill="currentColor" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="border-t border-slate-100 p-4">
          <article className="grid grid-cols-[84px_1fr_auto] gap-3">
            <Link href={selected.href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
              <Image src={selected.imageUrl} alt={selected.title} fill sizes="84px" className="object-cover" />
            </Link>
            <Link href={selected.href} className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{selected.title}</p>
              <p className="mt-1 truncate text-sm text-slate-500">{selected.subtitle}</p>
              <p className="mt-2 text-xs font-semibold text-teal-700">
                {categoryLabels[selected.category].zh} · {selected.meta}
              </p>
            </Link>
            <SaveButton
              item={{
                id: selected.id,
                type: "place",
                titleZh: selected.title,
                titleKo: selected.subtitle,
                href: selected.href,
                imageUrl: selected.imageUrl,
                meta: selected.meta,
              }}
            />
          </article>
        </div>
      ) : null}
    </section>
  );
}
