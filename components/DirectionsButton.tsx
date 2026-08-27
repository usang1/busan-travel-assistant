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
  { id: "naver", label: "Naver" },
  { id: "kakao", label: "Kakao" },
  { id: "google", label: "Google" },
];

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

  function openProvider(provider: DirectionsProvider) {
    const url = buildDirectionsUrl({ provider, name, address, coordinates });

    void recordPlaceEvent({
      eventType: "directions_click",
      placeId,
      locale,
      userId: user?.id,
      metadata: { provider },
    });

    window.open(url, "_blank", "noopener,noreferrer");
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
        길찾기
      </button>

      {open ? (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-40 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => openProvider(provider.id)}
              className="flex h-11 w-full items-center justify-between px-3 text-sm font-black text-slate-800 transition hover:bg-slate-50"
            >
              {provider.label}
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
