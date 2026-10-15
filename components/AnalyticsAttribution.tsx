"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureSessionAttribution } from "@/lib/analytics-source";
import { recordProductEvent } from "@/lib/place-events";
import { defaultLocale, locales, type Locale } from "@/lib/i18n";

export function AnalyticsAttribution() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureSessionAttribution();
    const locale = readLocale(pathname);
    const pageKey = `spotzari-page-view:${pathname}`;
    const lastRecordedAt = Number(window.sessionStorage.getItem(pageKey) || 0);
    if (Date.now() - lastRecordedAt >= 30_000) {
      window.sessionStorage.setItem(pageKey, String(Date.now()));
      void recordProductEvent({ eventType: "page_view", locale, metadata: { page_path: pathname } });
    }
  }, [pathname, searchParams]);

  return null;
}

function readLocale(pathname: string): Locale {
  const candidate = pathname.split("/").filter(Boolean)[0];
  return locales.includes(candidate as Locale) ? candidate as Locale : defaultLocale;
}
