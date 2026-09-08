"use client";

import { ExternalLink, Navigation } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { buildDirectionsUrl, type DirectionsProvider } from "@/lib/directions";
import { recordPlaceEvent } from "@/lib/place-events";
import type { Coordinates } from "@/lib/location";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DirectionsButtonProps = {
  placeId: string;
  name: string;
  address?: string;
  coordinates?: Coordinates | null;
  locale: Locale;
  compact?: boolean;
  className?: string;
};

const providers: Array<{ id: DirectionsProvider; label: string }> = [
  { id: "naver", label: "Naver Map" },
  { id: "kakao", label: "KakaoMap" },
  { id: "google", label: "Google Maps" },
];

const copy: Record<Locale, { directions: string; searchOnly: string }> = {
  zh: { directions: "打开地图", searchOnly: "坐标未确认，将用名称搜索。" },
  en: { directions: "Open map", searchOnly: "Coordinates need checking, so this will search by name." },
  ja: { directions: "地図を開く", searchOnly: "座標未確認のため名称で検索します。" },
  ko: { directions: "지도 열기", searchOnly: "좌표 확인이 필요해 장소명으로 검색합니다." },
};

export function DirectionsButton({
  placeId,
  name,
  address,
  coordinates,
  locale,
  compact = false,
  className,
}: DirectionsButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const text = copy[locale];

  function recordProvider(provider: DirectionsProvider) {
    void recordPlaceEvent({
      eventType: "directions_click",
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
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition active:scale-95",
          compact ? "h-10 px-3" : "h-12 px-4",
        )}
      >
        <Navigation size={compact ? 15 : 18} aria-hidden="true" />
        {text.directions}
      </button>

      {open ? (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-52 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          {!coordinates ? <p className="px-3 py-2 text-xs font-semibold leading-4 text-slate-500">{text.searchOnly}</p> : null}
          {providers.map((provider) => (
            <a
              key={provider.id}
              href={buildDirectionsUrl({ provider: provider.id, name, address, coordinates })}
              target="_blank"
              rel="noreferrer"
              onClick={() => recordProvider(provider.id)}
              className="flex h-11 w-full items-center justify-between px-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
            >
              {provider.label}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
