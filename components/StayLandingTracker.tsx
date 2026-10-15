"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { recordProductEvent } from "@/lib/place-events";
import type { Locale } from "@/lib/i18n";

export function StayLandingTracker({ stayId, locale }: { stayId: string; locale: Locale }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("utm_medium") !== "qr" && !searchParams.get("sp_stay")) return;
    const key = `spotzari-stay-qr:${stayId}:${searchParams.get("sp_campaign") || "direct"}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void recordProductEvent({
      eventType: "stay_qr_landing",
      locale,
      metadata: { stay_id: stayId, campaign_id: searchParams.get("sp_campaign") || undefined },
    });
  }, [locale, searchParams, stayId]);

  return null;
}
