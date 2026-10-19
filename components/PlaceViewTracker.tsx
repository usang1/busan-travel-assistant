"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { writeRecentPlace } from "@/lib/recent-places";
import type { Locale } from "@/lib/i18n";
import type { PlaceCategory } from "@/types/database";

type PlaceViewTrackerProps = {
  place: {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    href: string;
    imageUrl: string;
    category: PlaceCategory;
    area?: string;
  };
  locale: Locale;
};

export function PlaceViewTracker({ place, locale }: PlaceViewTrackerProps) {
  const { user } = useAuth();

  useEffect(() => {
    writeRecentPlace(place);
    void recordPlaceEvent({
      eventType: "place_view",
      locale,
      placeId: place.id,
      userId: user?.id,
      metadata: {
        category: place.category,
        area: place.area,
        slug: place.slug,
      },
    });
  }, [locale, place, user?.id]);

  return null;
}
