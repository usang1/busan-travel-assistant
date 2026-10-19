"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { recordProductEvent } from "@/lib/place-events";
import type { Locale } from "@/lib/i18n";
import type { PlaceActionEventType } from "@/types/database";

type AnalyticsLinkProps = {
  href: string;
  className: string;
  eventType: PlaceActionEventType;
  locale: Locale;
  placeId?: string;
  metadata: Record<string, unknown>;
  target?: "_blank";
  rel?: string;
  children: ReactNode;
};

export function AnalyticsLink({ href, className, eventType, locale, placeId, metadata, target, rel, children }: AnalyticsLinkProps) {
  const { user } = useAuth();
  return (
    <Link
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={() => void recordProductEvent({ eventType, locale, placeId, userId: user?.id, metadata })}
    >
      {children}
    </Link>
  );
}

