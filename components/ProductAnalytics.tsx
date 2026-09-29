"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { recordProductEvent } from "@/lib/place-events";
import type { Locale } from "@/lib/i18n";
import type { PlaceActionEventType } from "@/types/database";

const recorded = new Set<string>();

type ProductAnalyticsProps = {
  eventType: PlaceActionEventType;
  locale: Locale;
  placeId?: string;
  metadata?: Record<string, unknown>;
  mode?: "mount" | "visible";
  dedupeKey?: string;
};

export function ProductAnalytics({ eventType, locale, placeId, metadata, mode = "mount", dedupeKey }: ProductAnalyticsProps) {
  const { user } = useAuth();
  const markerRef = useRef<HTMLSpanElement>(null);
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  useEffect(() => {
    const key = dedupeKey ?? `${eventType}:${placeId ?? "page"}`;
    const send = () => {
      if (recorded.has(key)) return;
      recorded.add(key);
      void recordProductEvent({ eventType, locale, placeId, userId: user?.id, metadata: metadataRef.current });
    };

    if (mode === "mount" || !markerRef.current || !("IntersectionObserver" in window)) {
      send();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.4)) {
        send();
        observer.disconnect();
      }
    }, { threshold: [0.4] });
    observer.observe(markerRef.current);
    return () => observer.disconnect();
  }, [dedupeKey, eventType, locale, mode, placeId, user?.id]);

  return <span ref={markerRef} className="sr-only" aria-hidden="true" />;
}

