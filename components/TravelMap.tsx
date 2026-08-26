"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Navigation, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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

const minZoom = 1;
const maxZoom = 3;
const minLatitudeSpan = 0.035;
const minLongitudeSpan = 0.045;
const boundsPaddingRatio = 0.45;

type MapView = {
  zoom: number;
  centerX: number;
  centerY: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startView: MapView;
  hasMoved: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function keepViewInBounds(view: MapView): MapView {
  if (view.zoom <= minZoom) {
    return { zoom: minZoom, centerX: 50, centerY: 50 };
  }

  const edge = 50 / view.zoom;

  return {
    zoom: view.zoom,
    centerX: clamp(view.centerX, edge, 100 - edge),
    centerY: clamp(view.centerY, edge, 100 - edge),
  };
}

export function TravelMap({ center, markers, userLocation, provider }: TravelMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(markers[0]?.id ?? null);
  const [mapView, setMapView] = useState<MapView>({ zoom: 1, centerX: 50, centerY: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressMarkerClickRef = useRef(false);
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
    const latCenter = (minLat + maxLat) / 2;
    const lngCenter = (minLng + maxLng) / 2;
    const latSpan = Math.max(maxLat - minLat, minLatitudeSpan);
    const lngSpan = Math.max(maxLng - minLng, minLongitudeSpan);
    const paddedLatSpan = latSpan * (1 + boundsPaddingRatio * 2);
    const paddedLngSpan = lngSpan * (1 + boundsPaddingRatio * 2);

    return {
      minLat: latCenter - paddedLatSpan / 2,
      maxLat: latCenter + paddedLatSpan / 2,
      minLng: lngCenter - paddedLngSpan / 2,
      maxLng: lngCenter + paddedLngSpan / 2,
    };
  }, [center, markers, userLocation]);

  function toBasePoint(position: Coordinates) {
    const x = ((position.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 82 + 9;
    const y = (1 - (position.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 72 + 14;

    return {
      x: clamp(x, 6, 94),
      y: clamp(y, 10, 88),
    };
  }

  function toPoint(position: Coordinates) {
    const point = toBasePoint(position);
    const x = 50 + (point.x - mapView.centerX) * mapView.zoom;
    const y = 50 + (point.y - mapView.centerY) * mapView.zoom;

    return {
      left: `${x}%`,
      top: `${y}%`,
    };
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = ((event.clientX - rect.left) / rect.width) * 100;
    const cursorY = ((event.clientY - rect.top) / rect.height) * 100;

    setMapView((current) => {
      const nextZoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.001), minZoom, maxZoom);
      const worldX = current.centerX + (cursorX - 50) / current.zoom;
      const worldY = current.centerY + (cursorY - 50) / current.zoom;

      return keepViewInBounds({
        zoom: nextZoom,
        centerX: worldX - (cursorX - 50) / nextZoom,
        centerY: worldY - (cursorY - 50) / nextZoom,
      });
    });
  }

  function changeZoom(direction: "in" | "out") {
    setMapView((current) =>
      keepViewInBounds({
        ...current,
        zoom: clamp(current.zoom * (direction === "in" ? 1.25 : 0.8), minZoom, maxZoom),
      }),
    );
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target instanceof HTMLElement && event.target.closest("[data-map-control]"))) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startView: mapView,
      hasMoved: false,
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - dragState.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - dragState.startY) / rect.height) * 100;

    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      dragState.hasMoved = true;
    }

    setMapView(
      keepViewInBounds({
        ...dragState.startView,
        centerX: dragState.startView.centerX - deltaX / dragState.startView.zoom,
        centerY: dragState.startView.centerY - deltaY / dragState.startView.zoom,
      }),
    );
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId === event.pointerId) {
      suppressMarkerClickRef.current = dragState.hasMoved;
      dragStateRef.current = null;
    }

    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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

      <div
        className={[
          "relative h-[360px] touch-none overflow-hidden bg-[linear-gradient(135deg,#dff7f0_0%,#edf7ff_52%,#f8fafc_100%)]",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        ].join(" ")}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className="absolute inset-0 transition-transform duration-100"
          style={{
            transform: `translate(${50 - mapView.centerX}%, ${50 - mapView.centerY}%) scale(${mapView.zoom})`,
            transformOrigin: `${mapView.centerX}% ${mapView.centerY}%`,
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-20 -translate-y-1/2 bg-sky-200/70" />
          <div className="absolute left-0 top-[52%] h-2 w-full -rotate-6 bg-white/80" />
          <div className="absolute left-0 top-[37%] h-2 w-full rotate-3 bg-white/70" />
          <div className="absolute inset-6 rounded-[28px] border border-white/70" />
        </div>

        <div
          className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur"
          data-map-control
        >
          <button
            type="button"
            onClick={() => changeZoom("out")}
            className="grid size-8 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-40"
            disabled={mapView.zoom <= minZoom}
            aria-label="지도 축소"
            title="지도 축소"
          >
            <ZoomOut size={16} aria-hidden="true" />
          </button>
          <span className="min-w-10 text-center text-xs font-black text-slate-700">{mapView.zoom.toFixed(1)}x</span>
          <button
            type="button"
            onClick={() => changeZoom("in")}
            className="grid size-8 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-40"
            disabled={mapView.zoom >= maxZoom}
            aria-label="지도 확대"
            title="지도 확대"
          >
            <ZoomIn size={16} aria-hidden="true" />
          </button>
        </div>

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
              onClick={() => {
                if (suppressMarkerClickRef.current) {
                  suppressMarkerClickRef.current = false;
                  return;
                }

                setSelectedId(marker.id);
              }}
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
