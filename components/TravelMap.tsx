"use client";

import { MapPin, Navigation, Plus, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { cn } from "@/lib/utils";
import { defaultLocale, type Locale } from "@/lib/i18n";
import type { Coordinates } from "@/lib/location";
import { naverMapNcpKeyId, type MapBounds, type MapMarker, type TravelMapProvider } from "@/lib/map-provider";

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

type NaverScriptStatus = "loading" | "ready" | "error";

type NaverLatLng = {
  lat: () => number;
  lng: () => number;
};

type NaverLatLngBounds = {
  getSW: () => NaverLatLng;
  getNE: () => NaverLatLng;
};

type NaverMapInstance = {
  setCenter: (position: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number;
  getBounds: () => NaverLatLngBounds;
  fitBounds: (bounds: NaverLatLngBounds) => void;
};

type NaverMarkerInstance = {
  setMap: (map: NaverMapInstance | null) => void;
};

type NaverInfoWindowInstance = {
  open: (map: NaverMapInstance, marker: NaverMarkerInstance) => void;
  close: () => void;
};

type NaverEventListener = unknown;

type NaverMapsNamespace = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMapInstance;
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  LatLngBounds: new (southWest: NaverLatLng, northEast: NaverLatLng) => NaverLatLngBounds;
  Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
  InfoWindow: new (options: Record<string, unknown>) => NaverInfoWindowInstance;
  Point: new (x: number, y: number) => unknown;
  Event: {
    addListener: (target: unknown, eventName: string, listener: () => void) => NaverEventListener;
    removeListener: (listener: NaverEventListener) => void;
    trigger: (target: unknown, eventName: string) => void;
  };
};

declare global {
  interface Window {
    naver?: {
      maps?: NaverMapsNamespace;
    };
  }
}

const markerColor: Record<MapMarker["category"], string> = {
  restaurant: "bg-teal-700",
  cafe: "bg-teal-700",
  bar: "bg-teal-700",
  attraction: "bg-teal-700",
  shopping: "bg-teal-700",
  photo_spot: "bg-teal-700",
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
let naverMapsPromise: Promise<NaverMapsNamespace> | null = null;

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

export function TravelMap(props: TravelMapProps) {
  if (props.provider.id === "naver" && naverMapNcpKeyId) {
    return <NaverTravelMap {...props} ncpKeyId={naverMapNcpKeyId} />;
  }

  return <FallbackTravelMap {...props} />;
}

function NaverTravelMap({
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
  ncpKeyId,
}: TravelMapProps & { ncpKeyId: string }) {
  const [scriptStatus, setScriptStatus] = useState<NaverScriptStatus>("loading");
  const [maps, setMaps] = useState<NaverMapsNamespace | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const markerRefs = useRef(new Map<string, NaverMarkerInstance>());
  const userMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const infoWindowRef = useRef<NaverInfoWindowInstance | null>(null);
  const idleListenerRef = useRef<NaverEventListener | null>(null);
  const viewportSourceRef = useRef<"user" | "program">("program");
  const onViewportSettledRef = useRef(onViewportSettled);
  const { user } = useAuth();

  onViewportSettledRef.current = onViewportSettled;

  useEffect(() => {
    let active = true;

    setScriptStatus("loading");
    loadNaverMaps(ncpKeyId)
      .then((loadedMaps) => {
        if (!active) {
          return;
        }

        setMaps(loadedMaps);
        setScriptStatus("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setScriptStatus("error");
      });

    return () => {
      active = false;
    };
  }, [ncpKeyId]);

  useEffect(() => {
    if (!maps || !mapElementRef.current || mapInstanceRef.current) {
      return;
    }

    const map = new maps.Map(mapElementRef.current, {
      center: toNaverLatLng(maps, center),
      zoom: 15,
      minZoom: 10,
      maxZoom: 19,
      scaleControl: false,
      logoControl: true,
      mapDataControl: false,
      zoomControl: true,
    });

    mapInstanceRef.current = map;
    viewportSourceRef.current = "program";
    idleListenerRef.current = maps.Event.addListener(map, "idle", () => {
      const bounds = getNaverBounds(map);

      if (!bounds) {
        return;
      }

      onViewportSettledRef.current?.(bounds, viewportSourceRef.current);
      viewportSourceRef.current = "user";
    });

    window.setTimeout(() => {
      maps.Event.trigger(map, "resize");
      fitNaverMapToContent(maps, map, center, markers, userLocation);
    }, 0);

    return () => {
      if (idleListenerRef.current) {
        maps.Event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }

      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current.clear();
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      closeNaverInfoWindow(infoWindowRef.current);
      infoWindowRef.current = null;
      mapInstanceRef.current = null;
    };
  }, [maps]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!maps || !map) {
      return;
    }

    viewportSourceRef.current = "program";
    fitNaverMapToContent(maps, map, center, markers, userLocation);
  }, [center, maps, markers, userLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!maps || !map) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current.clear();
    closeNaverInfoWindow(infoWindowRef.current);
    infoWindowRef.current = null;

    markers.forEach((marker) => {
      const markerInstance = new maps.Marker({
        map,
        position: toNaverLatLng(maps, marker.position),
        title: marker.title,
        icon: {
          content: naverMarkerHtml(marker, selectedId === marker.id),
          anchor: new maps.Point(18, 44),
        },
      });

      maps.Event.addListener(markerInstance, "click", () => {
        onSelectMarker?.(marker.id);
        closeNaverInfoWindow(infoWindowRef.current);
        infoWindowRef.current = openNaverInfoWindow(maps, map, markerInstance, marker);
        viewportSourceRef.current = "program";
        map.setCenter(toNaverLatLng(maps, marker.position));
        map.setZoom(Math.max(map.getZoom(), 16));

        void recordPlaceEvent({
          eventType: "marker_click",
          locale,
          placeId: marker.id,
          userId: user?.id,
          metadata: { provider: provider.id },
        });
      });

      markerRefs.current.set(marker.id, markerInstance);
    });

    const selectedMarker = selectedId ? markers.find((marker) => marker.id === selectedId) : null;
    const selectedMarkerInstance = selectedId ? markerRefs.current.get(selectedId) : null;

    if (selectedMarker && selectedMarkerInstance) {
      closeNaverInfoWindow(infoWindowRef.current);
      infoWindowRef.current = openNaverInfoWindow(maps, map, selectedMarkerInstance, selectedMarker);
    }
  }, [locale, maps, markers, onSelectMarker, provider.id, selectedId, user?.id]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!maps || !map) {
      return;
    }

    userMarkerRef.current?.setMap(null);
    userMarkerRef.current = null;

    if (!userLocation) {
      return;
    }

    userMarkerRef.current = new maps.Marker({
      map,
      position: toNaverLatLng(maps, userLocation),
      title: "현재 위치",
      icon: {
        content: naverUserMarkerHtml(),
        anchor: new maps.Point(16, 16),
      },
    });
  }, [maps, userLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;

    if (!maps || !map || !focusRequest) {
      return;
    }

    const target = markers.find((marker) => marker.id === focusRequest.id);
    const markerInstance = markerRefs.current.get(focusRequest.id);

    if (!target) {
      return;
    }

    viewportSourceRef.current = "program";
    map.setCenter(toNaverLatLng(maps, target.position));
    map.setZoom(Math.max(map.getZoom(), 16));

    if (markerInstance) {
      closeNaverInfoWindow(infoWindowRef.current);
      infoWindowRef.current = openNaverInfoWindow(maps, map, markerInstance, target);
    }
  }, [focusRequest, maps, markers]);

  if (scriptStatus === "error") {
    return <FallbackTravelMap center={center} markers={markers} userLocation={userLocation} provider={provider} locale={locale} selectedId={selectedId} focusRequest={focusRequest} className={className} searchAreaVisible={searchAreaVisible} onSearchArea={onSearchArea} onSelectMarker={onSelectMarker} onViewportSettled={onViewportSettled} />;
  }

  return (
    <section className={cn("relative overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200", className)}>
      <div ref={mapElementRef} className="relative h-full min-h-[420px] overflow-hidden bg-[#e9f2ef]" />

      <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-2xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        {provider.label} · {markers.length}
      </div>

      {searchAreaVisible ? (
        <button
          type="button"
          onClick={() => {
            const map = mapInstanceRef.current;
            const bounds = map ? getNaverBounds(map) : null;

            if (bounds) {
              onSearchArea?.(bounds);
            }
          }}
          className="absolute left-1/2 top-3 z-40 inline-flex h-10 -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-lg transition active:scale-95"
        >
          <Search size={16} aria-hidden="true" />
          이 지역에서 검색
        </button>
      ) : null}

      {scriptStatus === "loading" ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-white/70 text-sm font-bold text-slate-600 backdrop-blur-sm">
          지도 로딩 중
        </div>
      ) : null}
    </section>
  );
}

function FallbackTravelMap({
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

function loadNaverMaps(ncpKeyId: string): Promise<NaverMapsNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Naver Maps can only load in the browser."));
  }

  if (window.naver?.maps) {
    return Promise.resolve(window.naver.maps);
  }

  if (naverMapsPromise) {
    return naverMapsPromise;
  }

  naverMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-naver-maps-sdk='true']");

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.naver?.maps) {
          resolve(window.naver.maps);
          return;
        }

        reject(new Error("Naver Maps SDK loaded without maps namespace."));
      });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Naver Maps SDK.")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(ncpKeyId)}`;
    script.async = true;
    script.dataset.naverMapsSdk = "true";
    script.addEventListener("load", () => {
      if (window.naver?.maps) {
        resolve(window.naver.maps);
        return;
      }

      reject(new Error("Naver Maps SDK loaded without maps namespace."));
    });
    script.addEventListener("error", () => reject(new Error("Failed to load Naver Maps SDK.")));
    document.head.appendChild(script);
  });

  return naverMapsPromise;
}

function toNaverLatLng(maps: NaverMapsNamespace, position: Coordinates) {
  return new maps.LatLng(position.latitude, position.longitude);
}

function fitNaverMapToContent(
  maps: NaverMapsNamespace,
  map: NaverMapInstance,
  center: Coordinates,
  markers: MapMarker[],
  userLocation?: Coordinates | null,
) {
  const positions = [
    center,
    ...markers.map((marker) => marker.position),
    ...(userLocation ? [userLocation] : []),
  ];

  if (positions.length <= 1) {
    map.setCenter(toNaverLatLng(maps, center));
    map.setZoom(15);
    return;
  }

  const latitudes = positions.map((position) => position.latitude);
  const longitudes = positions.map((position) => position.longitude);
  const bounds = new maps.LatLngBounds(
    new maps.LatLng(Math.min(...latitudes), Math.min(...longitudes)),
    new maps.LatLng(Math.max(...latitudes), Math.max(...longitudes)),
  );

  map.fitBounds(bounds);
}

function getNaverBounds(map: NaverMapInstance): MapBounds | null {
  const bounds = map.getBounds();
  const southWest = bounds.getSW();
  const northEast = bounds.getNE();

  return {
    minLat: southWest.lat(),
    maxLat: northEast.lat(),
    minLng: southWest.lng(),
    maxLng: northEast.lng(),
  };
}

function openNaverInfoWindow(
  maps: NaverMapsNamespace,
  map: NaverMapInstance,
  markerInstance: NaverMarkerInstance,
  marker: MapMarker,
): NaverInfoWindowInstance {
  const infoWindow = new maps.InfoWindow({
    content: [
      '<div style="min-width:190px;padding:12px 13px;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a;">',
      `<strong style="display:block;font-size:14px;line-height:1.35;">${escapeHtml(marker.title)}</strong>`,
      marker.subtitle ? `<span style="display:block;margin-top:3px;font-size:12px;line-height:1.35;color:#64748b;">${escapeHtml(marker.subtitle)}</span>` : "",
      `<span style="display:block;margin-top:8px;font-size:12px;line-height:1.35;color:#475569;">${escapeHtml(marker.meta)}</span>`,
      marker.price || marker.recommendation
        ? `<span style="display:block;margin-top:6px;font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml([marker.price, marker.recommendation ? `推荐度 ${marker.recommendation}` : ""].filter(Boolean).join(" · "))}</span>`
        : "",
      marker.tags?.length
        ? `<span style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">${marker.tags
            .slice(0, 4)
            .map((tag) => `<span style="border-radius:999px;background:#f1f5f9;padding:3px 7px;font-size:11px;font-weight:700;color:#334155;">${escapeHtml(tag)}</span>`)
            .join("")}</span>`
        : "",
      `<a href="${escapeHtml(marker.href)}" style="display:inline-flex;margin-top:10px;font-size:12px;font-weight:800;color:#047857;text-decoration:none;">详情</a>`,
      "</div>",
    ].join(""),
    borderWidth: 0,
    disableAnchor: false,
    backgroundColor: "white",
  });

  infoWindow.open(map, markerInstance);
  return infoWindow;
}

function closeNaverInfoWindow(infoWindow: NaverInfoWindowInstance | null) {
  infoWindow?.close();
}

function naverMarkerHtml(marker: MapMarker, active: boolean) {
  const color = naverMarkerColor(marker.category);
  const ring = active ? "#0f172a" : "rgba(255,255,255,0.92)";

  return [
    `<div title="${escapeHtml(marker.title)}" style="position:relative;width:36px;height:44px;transform:translateY(-2px);">`,
    `<div style="display:grid;place-items:center;width:36px;height:36px;border-radius:999px;background:${color};color:white;box-shadow:0 12px 28px rgba(15,23,42,0.28);border:4px solid ${ring};">`,
    '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>',
    "</div>",
    active ? `<div style="position:absolute;left:50%;top:40px;max-width:150px;transform:translateX(-50%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:999px;background:#0f172a;padding:4px 10px;font-size:12px;font-weight:800;color:white;box-shadow:0 10px 24px rgba(15,23,42,0.22);">${escapeHtml(marker.title)}</div>` : "",
    "</div>",
  ].join("");
}

function naverUserMarkerHtml() {
  return [
    '<div style="display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:#2563eb;color:white;box-shadow:0 10px 24px rgba(37,99,235,0.32);border:4px solid #dbeafe;">',
    '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 7 19-7-4-7 4 7-19z"/></svg>',
    "</div>",
  ].join("");
}

function naverMarkerColor(category: MapMarker["category"]) {
  return {
    restaurant: "#0f766e",
    cafe: "#0f766e",
    bar: "#0f766e",
    attraction: "#0f766e",
    shopping: "#0f766e",
    photo_spot: "#0f766e",
    luggage: "#1e293b",
  }[category];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
