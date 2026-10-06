"use client";

import { ExternalLink, Navigation } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { buildDirectionsUrl, type DirectionsProvider } from "@/lib/directions";
import { recordPlaceEvent } from "@/lib/place-events";
import { rememberMapOpen } from "@/lib/place-visit-memory";
import type { Coordinates } from "@/lib/location";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DirectionsButtonProps = {
  placeId: string;
  name: string;
  address?: string;
  coordinates?: Coordinates | null;
  origin?: { name: string; coordinates?: Coordinates | null };
  locale: Locale;
  compact?: boolean;
  className?: string;
};

const providerLabels: Record<Locale, Record<DirectionsProvider, string>> = {
  zh: { naver: "Naver App", naver_web: "Naver 网页地图", kakao: "KakaoMap", google: "Google Maps" },
  en: { naver: "Naver app", naver_web: "Naver web map", kakao: "KakaoMap", google: "Google Maps" },
  ja: { naver: "Naverアプリ", naver_web: "Naverウェブ地図", kakao: "KakaoMap", google: "Google Maps" },
  ko: { naver: "네이버 앱", naver_web: "네이버 웹지도", kakao: "카카오맵", google: "Google Maps" },
};

const providers: DirectionsProvider[] = ["naver", "naver_web", "kakao", "google"];

const copy: Record<Locale, { directions: string; searchOnly: string }> = {
  zh: { directions: "选择地图", searchOnly: "坐标未确认，将用名称搜索。" },
  en: { directions: "Choose map", searchOnly: "Coordinates need checking, so this will search by name." },
  ja: { directions: "地図を選択", searchOnly: "座標未確認のため名称で検索します。" },
  ko: { directions: "지도 선택", searchOnly: "좌표 확인이 필요해 장소명으로 검색합니다." },
};

export function DirectionsButton({
  placeId,
  name,
  address,
  coordinates,
  origin,
  locale,
  compact = false,
  className,
}: DirectionsButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const text = copy[locale];

  function recordProvider(provider: DirectionsProvider) {
    rememberMapOpen(placeId);
    void recordPlaceEvent({
      eventType: "map_opened",
      placeId,
      locale,
      userId: user?.id,
      metadata: { provider },
    });
    setOpen(false);
  }

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition active:scale-95",
          compact ? "h-11 px-3" : "h-12 px-4",
        )}
      >
        <Navigation size={compact ? 15 : 18} aria-hidden="true" />
        {text.directions}
      </button>

      {open ? (
        <div role="menu" className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          {!coordinates ? <p className="px-3 py-2 text-xs font-semibold leading-4 text-slate-500">{text.searchOnly}</p> : null}
          {providers.map((provider) => (
            <a
              key={provider}
              href={buildDirectionsUrl({ provider, name, address, coordinates, origin })}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => recordProvider(provider)}
              className="flex h-11 w-full items-center justify-between px-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
            >
              {providerLabels[locale][provider]}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
