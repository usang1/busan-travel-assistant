"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import type { Locale } from "@/lib/i18n";
import type { GuideType } from "@/types/guide";

type GuidePlaceLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  guideId: string;
  guideType: GuideType;
  area: string;
  placeId: string;
  locale: Locale;
  position: number;
};

export function GuidePlaceLink({
  href,
  children,
  className,
  guideId,
  guideType,
  area,
  placeId,
  locale,
  position,
}: GuidePlaceLinkProps) {
  const { user } = useAuth();

  function trackClick() {
    void recordPlaceEvent({
      eventType: "guide_place_click",
      locale,
      placeId,
      userId: user?.id,
      metadata: {
        guide_id: guideId,
        guide_type: guideType,
        area,
        position,
      },
    });
  }

  return (
    <Link href={href} className={className} onClick={trackClick}>
      {children}
    </Link>
  );
}
