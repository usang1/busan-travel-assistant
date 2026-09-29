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
  metadata: Record<string, unknown>;
  children: ReactNode;
};

export function AnalyticsLink({ href, className, eventType, locale, metadata, children }: AnalyticsLinkProps) {
  const { user } = useAuth();
  return (
    <Link
      href={href}
      className={className}
      onClick={() => void recordProductEvent({ eventType, locale, userId: user?.id, metadata })}
    >
      {children}
    </Link>
  );
}

