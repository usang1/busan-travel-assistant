"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import type { Locale } from "@/lib/i18n";
import type { GuideType } from "@/types/guide";

type GuideViewTrackerProps = {
  guideId: string;
  guideType: GuideType;
  area: string;
  locale: Locale;
};

export function GuideViewTracker({ guideId, guideType, area, locale }: GuideViewTrackerProps) {
  const { user } = useAuth();

  useEffect(() => {
    void recordPlaceEvent({
      eventType: "guide_view",
      locale,
      userId: user?.id,
      metadata: {
        guide_id: guideId,
        guide_type: guideType,
        area,
      },
    });
  }, [area, guideId, guideType, locale, user?.id]);

  return null;
}
