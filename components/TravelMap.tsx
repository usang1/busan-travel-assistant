"use client";

import { MapPin, Navigation, Plus, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { cn } from "@/lib/utils";
import { defaultLocale, type Locale } from "@/lib/i18n";
import type { Coordinates } from "@/lib/location";
import type { MapBounds, MapMarker, TravelMapProvider } from "@/lib/map-provider";

type TravelMapProps = {
  center: Coordinates;
  markers: MapMarker[];
  userLocation?: Coordinates | null;
  provider: TravelMapProvider;
  locale?: Locale;
  selectedId?: string | null;
  focusRequest?: { id: string; sequence: number } | null;
  className?: string;
  searchAreaVisible?: boolean;
  onSearchArea?: (bounds: MapBounds) => void;
  onSelectMarker?: (id: string) => void;
  onViewportSettled?: (bounds: MapBounds, source: "user" | "program") => void;
};

type WorldPoint = {
  x: number;
  y: number;
};

type MapView = {
  zoom: number;
  center: WorldPoint;
};

type PointerSnapshot = {
  id: number;
  x: number;
  y: number;
};

type GestureState =
  | {
      type: "drag";
      startPointer: PointerSnapshot;
      startView: MapView;
      hasMoved: boolean;
    }
  | {
      type: "pinch";
      startDistance: number;
      startMidpoint: WorldPoint;
      startView: MapView;
    };

type Cluster = {
  id: string;
  point: WorldPoint;
  markerIds: string[];
  category: MapMarker["category"];
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
const maxZoom = 5;
const defaultZoom = 1.15;
const focusZoom = 3.2;
const minLatitudeSpan = 0.028;
const minLongitudeSpan = 0.038;
const boundsPaddingRatio = 0.32;
const clusterDistance = 5.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: PointerSnapshot, b: PointerSnapshot) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PointerSnapshot, b: PointerSnapshot): WorldPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function keepViewInBounds(view: MapView): MapView {
  const zoom = clamp(view.zoom, minZoom, maxZoom);
  const edge = 50 / zoom;

  return {
    zoom,
    center: {
      x: zoom <= minZoom ? 50 : clamp(view.center.x, edge, 100 - edge),
      y: zoom <= minZoom ? 50 : clamp(view.center.y, edge, 100 - edge),
    },
  };
}

export function TravelMap({
  center,
  markers,
  userLocation,
  provider,
  locale = defaultLocale,
  selectedId,
  focusRequest,
  className,
  searchAreaVisible = false,
  onSearchArea,
  onSelectMarker,
  onViewportSettled,
}: TravelMapProps) {
  const [mapView, setMapView] = useState<MapView>({ zoom: defaultZoom, center: { x: 50, y: 50 } });
  const [isDragging, setIsDragging] = useState(false);
  const pointersRef = useRef(new Map<number, PointerSnapshot>());
  const gestureRef = useRef<GestureState | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const { user } = useAuth();

  const world = useMemo(() => {
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

  const markerPoints = useMemo(() => {
    return markers.map((marker) => ({
      marker,
      point: toWorldPoint(marker.position, world),
    }));
  }, [markers, world]);

  const selectedMarker = selectedId ? markers.find((marker) => marker.id === selectedId) : null;
  const selectedPoint = selectedMarker ? toWorldPoint(selectedMarker.position, world) : null;
  const bounds = useMemo(() => viewToBounds(mapView, world), [mapView, world]);
  const clusters = useMemo(() => clusterMarkers(markerPoints, mapView.zoom), [markerPoints, mapView.zoom]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const target = markerPoints.find((item) => item.marker.id === focusRequest.id);

    if (!target) {
      return;
    }

    const nextView = keepViewInBounds({
      zoom: Math.max(mapView.zoom, focusZoom),
      center: target.point,
    });

    setMapView(nextView);
    onViewportSettled?.(viewToBounds(nextView, world), "program");
  }, [focusRequest?.sequence]);

  useEffect(() => {
    const nextView = keepViewInBounds({ zoom: defaultZoom, center: { x: 50, y: 50 } });

    setMapView(nextView);
    onViewportSettled?.(viewToBounds(nextView, world), "program");
  }, [world.minLat, world.maxLat, world.minLng, world.maxLng]);

  function toScreenPoint(point: WorldPoint): WorldPoint {
    return {
      x: 50 + (point.x - mapView.center.x) * mapView.zoom,
      y: 50 + (point.y - mapView.center.y) * mapView.zoom,
    };
  }

  function containerToWorld(clientX: number, clientY: number, view = mapView) {
    const rect = mapRef.current?.getBoundingClientRect();

    if (!rect) {
      return { x: 50, y: 50 };
    }

    const screenX = ((clientX - rect.left) / rect.width) * 100;
    const screenY = ((clientY - rect.top) / rect.height) * 100;

    return {
      x: view.center.x + (screenX - 50) / view.zoom,
      y: view.center.y + (screenY - 50) / view.zoom,
    };
  }

  function settle(source: "user" | "program", view = mapView) {
    onViewportSettled?.(viewToBounds(view, world), source);
  }

  function zoomAt(clientX: number, clientY: number, multiplier: number, source: "user" | "program") {
    const rect = mapRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const cursorX = ((clientX - rect.left) / rect.width) * 100;
    const cursorY = ((clientY - rect.top) / rect.height) * 100;

    setMapView((current) => {
      const nextZoom = clamp(current.zoom * multiplier, minZoom, maxZoom);
      const worldX = current.center.x + (cursorX - 50) / current.zoom;
      const worldY = current.center.y + (cursorY - 50) / current.zoom;
      const nextView = keepViewInBounds({
        zoom: nextZoom,
        center: {
          x: worldX - (cursorX - 50) / nextZoom,
          y: worldY - (cursorY - 50) / nextZoom,
        },
      });

      window.setTimeout(() => settle(source, nextView), 0);
      return nextView;
    });
  }

  function changeZoom(direction: "in" | "out") {
    const rect = mapRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, direction === "in" ? 1.35 : 0.74, "user");
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0012), "user");
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLElement && event.target.closest("[data-map-control]")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });

    const pointers = Array.from(pointersRef.current.values());

    if (pointers.length >= 2) {
      gestureRef.current = {
        type: "pinch",
        startDistance: Math.max(1, distance(pointers[0], pointers[1])),
        startMidpoint: containerToWorld(midpoint(pointers[0], pointers[1]).x, midpoint(pointers[0], pointers[1]).y),
        startView: mapView,
      };
    } else {
      gestureRef.current = {
        type: "drag",
        startPointer: pointers[0],
        startView: mapView,
        hasMoved: false,
      };
    }

    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    pointersRef.current.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });

    const gesture = gestureRef.current;
    const rect = mapRef.current?.getBoundingClientRect();

    if (!gesture || !rect) {
      return;
    }

    const pointers = Array.from(pointersRef.current.values());

    if (gesture.type === "pinch" && pointers.length >= 2) {
      const nextDistance = Math.max(1, distance(pointers[0], pointers[1]));
      const nextZoom = clamp(gesture.startView.zoom * (nextDistance / gesture.startDistance), minZoom, maxZoom);
      const nextMidpoint = midpoint(pointers[0], pointers[1]);
      const screenX = ((nextMidpoint.x - rect.left) / rect.width) * 100;
      const screenY = ((nextMidpoint.y - rect.top) / rect.height) * 100;

      setMapView(
        keepViewInBounds({
          zoom: nextZoom,
          center: {
            x: gesture.startMidpoint.x - (screenX - 50) / nextZoom,
            y: gesture.startMidpoint.y - (screenY - 50) / nextZoom,
          },
        }),
      );
      suppressClickRef.current = true;
      return;
    }

    if (gesture.type !== "drag" || pointers.length !== 1) {
      return;
    }

    const pointer = pointers[0];
    const deltaX = ((pointer.x - gesture.startPointer.x) / rect.width) * 100;
    const deltaY = ((pointer.y - gesture.startPointer.y) / rect.height) * 100;

    if (Math.abs(deltaX) > 0.4 || Math.abs(deltaY) > 0.4) {
      gesture.hasMoved = true;
      suppressClickRef.current = true;
    }

    setMapView(
      keepViewInBounds({
        zoom: gesture.startView.zoom,
        center: {
          x: gesture.startView.center.x - deltaX / gesture.startView.zoom,
          y: gesture.startView.center.y - deltaY / gesture.startView.zoom,
        },
      }),
    );
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointersRef.current.size === 0) {
      setIsDragging(false);
      settle("user");
      gestureRef.current = null;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      return;
    }

    const pointers = Array.from(pointersRef.current.values());
    gestureRef.current = {
      type: "drag",
      startPointer: pointers[0],
      startView: mapView,
      hasMoved: true,
    };
  }

  function selectMarker(markerId: string) {
    if (suppressClickRef.current) {
      return;
    }

    onSelectMarker?.(markerId);
    const marker = markers.find((item) => item.id === markerId);

    if (marker) {
      const nextView = keepViewInBounds({
        zoom: Math.max(mapView.zoom, focusZoom),
        center: toWorldPoint(marker.position, world),
      });

      setMapView(nextView);
      settle("program", nextView);
    }

    void recordPlaceEvent({
      eventType: "marker_click",
      locale,
      placeId: markerId,
      userId: user?.id,
      metadata: { provider: provider.id },
    });
  }

  function selectCluster(cluster: Cluster) {
    const nextView = keepViewInBounds({
      zoom: Math.min(maxZoom, mapView.zoom * 1.65),
      center: cluster.point,
    });

    setMapView(nextView);
    settle("program", nextView);
    onSelectMarker?.(cluster.markerIds[0]);
  }

  return (
    <section className={cn("relative overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200", className)}>
      <div
        ref={mapRef}
        className={cn(
          "relative h-full min-h-[420px] touch-none select-none overflow-hidden bg-[#e9f2ef]",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className="absolute inset-[-12%] transition-transform duration-150"
          style={{
            transform: `translate(${50 - mapView.center.x}%, ${50 - mapView.center.y}%) scale(${mapView.zoom})`,
            transformOrigin: `${mapView.center.x}% ${mapView.center.y}%`,
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px)] bg-[size:56px_56px]" />
          <div className="absolute left-[-5%] top-[48%] h-24 w-[110%] -rotate-6 bg-sky-200/80" />
          <div className="absolute left-[-2%] top-[56%] h-4 w-[104%] -rotate-6 bg-white/80" />
          <div className="absolute left-[7%] top-[30%] h-3 w-[88%] rotate-3 rounded-full bg-white/75" />
          <div className="absolute left-[18%] top-[17%] h-3 w-[72%] -rotate-12 rounded-full bg-white/75" />
          <div className="absolute left-[34%] top-[0%] h-[115%] w-3 rotate-12 rounded-full bg-white/65" />
          <div className="absolute left-[60%] top-[9%] h-[88%] w-3 -rotate-3 rounded-full bg-white/65" />
        </div>

        <div className="absolute left-3 top-3 z-30 rounded-2xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          {provider.label} · {markers.length}
        </div>

        {searchAreaVisible ? (
          <button
            type="button"
            onClick={() => onSearchArea?.(bounds)}
            className="absolute left-1/2 top-3 z-40 inline-flex h-10 -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-lg transition active:scale-95"
            data-map-control
          >
            <Search size={16} aria-hidden="true" />
            이 지역에서 검색
          </button>
        ) : null}

        <div className="absolute right-3 top-3 z-30 flex flex-col gap-2" data-map-control>
          <button
            type="button"
            onClick={() => changeZoom("in")}
            className="grid size-10 place-items-center rounded-full bg-white/95 text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            disabled={mapView.zoom >= maxZoom}
            aria-label="지도 확대"
            title="지도 확대"
          >
            <ZoomIn size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => changeZoom("out")}
            className="grid size-10 place-items-center rounded-full bg-white/95 text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40"
            disabled={mapView.zoom <= minZoom}
            aria-label="지도 축소"
            title="지도 축소"
          >
            <ZoomOut size={18} aria-hidden="true" />
          </button>
        </div>

        {userLocation ? (
          <div className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={screenStyle(toScreenPoint(toWorldPoint(userLocation, world)))}>
            <div className="grid size-9 place-items-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-blue-100">
              <Navigation size={17} aria-hidden="true" />
            </div>
            <span className="absolute left-1/2 top-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-1 text-[11px] font-bold text-blue-700 shadow-sm">
              我
            </span>
          </div>
        ) : null}

        {clusters.map((cluster) => {
          const isSingle = cluster.markerIds.length === 1;
          const marker = isSingle ? markers.find((item) => item.id === cluster.markerIds[0]) : null;
          const active = selectedId ? cluster.markerIds.includes(selectedId) : false;

          if (!marker) {
            return (
              <button
                key={cluster.id}
                type="button"
                onClick={() => selectCluster(cluster)}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition active:scale-95"
                style={screenStyle(toScreenPoint(cluster.point))}
                aria-label={`${cluster.markerIds.length} places`}
              >
                <span className="grid size-11 place-items-center rounded-full bg-slate-950 text-sm font-black text-white shadow-lg ring-4 ring-white/80">
                  <Plus size={15} aria-hidden="true" />
                  <span className="sr-only">{cluster.markerIds.length}</span>
                </span>
                <span className="absolute left-7 top-1 grid min-w-6 place-items-center rounded-full bg-white px-1.5 text-[11px] font-black text-slate-950 shadow-sm">
                  {cluster.markerIds.length}
                </span>
              </button>
            );
          }

          return (
            <button
              key={marker.id}
              type="button"
              onClick={() => selectMarker(marker.id)}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-full transition",
                active ? "scale-110" : "hover:scale-105 active:scale-95",
              )}
              style={screenStyle(toScreenPoint(cluster.point))}
              aria-label={marker.title}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-full text-white shadow-lg ring-4",
                  markerColor[marker.category],
                  active ? "ring-slate-950" : "ring-white/85",
                )}
              >
                <MapPin size={19} fill="currentColor" aria-hidden="true" />
              </span>
              {active ? (
                <span className="absolute left-1/2 top-11 max-w-40 -translate-x-1/2 truncate rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white shadow-lg">
                  {marker.title}
                </span>
              ) : null}
            </button>
          );
        })}

        {selectedPoint ? (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-950/10"
            style={screenStyle(toScreenPoint(selectedPoint))}
          />
        ) : null}
      </div>
    </section>
  );
}

function toWorldPoint(position: Coordinates, bounds: MapBounds): WorldPoint {
  return {
    x: clamp(((position.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100, 0, 100),
    y: clamp((1 - (position.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100, 0, 100),
  };
}

function viewToBounds(view: MapView, world: MapBounds): MapBounds {
  const half = 50 / view.zoom;
  const left = clamp(view.center.x - half, 0, 100);
  const right = clamp(view.center.x + half, 0, 100);
  const top = clamp(view.center.y - half, 0, 100);
  const bottom = clamp(view.center.y + half, 0, 100);

  return {
    minLng: world.minLng + (left / 100) * (world.maxLng - world.minLng),
    maxLng: world.minLng + (right / 100) * (world.maxLng - world.minLng),
    minLat: world.maxLat - (bottom / 100) * (world.maxLat - world.minLat),
    maxLat: world.maxLat - (top / 100) * (world.maxLat - world.minLat),
  };
}

function screenStyle(point: WorldPoint) {
  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
  };
}

function clusterMarkers(items: Array<{ marker: MapMarker; point: WorldPoint }>, zoom: number): Cluster[] {
  if (zoom >= 2.4 || items.length < 18) {
    return items.map((item) => ({
      id: item.marker.id,
      point: item.point,
      markerIds: [item.marker.id],
      category: item.marker.category,
    }));
  }

  const clusters: Cluster[] = [];
  const used = new Set<string>();
  const threshold = clusterDistance / zoom;

  for (const item of items) {
    if (used.has(item.marker.id)) {
      continue;
    }

    const nearby = items.filter((candidate) => {
      if (used.has(candidate.marker.id)) {
        return false;
      }

      return Math.hypot(candidate.point.x - item.point.x, candidate.point.y - item.point.y) <= threshold;
    });

    nearby.forEach((candidate) => used.add(candidate.marker.id));

    clusters.push({
      id: nearby.map((candidate) => candidate.marker.id).join("-"),
      point: {
        x: nearby.reduce((sum, candidate) => sum + candidate.point.x, 0) / nearby.length,
        y: nearby.reduce((sum, candidate) => sum + candidate.point.y, 0) / nearby.length,
      },
      markerIds: nearby.map((candidate) => candidate.marker.id),
      category: item.marker.category,
    });
  }

  return clusters;
}
