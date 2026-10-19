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
    let lastRecordedAt = 0;
    try { lastRecordedAt = Number(window.sessionStorage.getItem(pageKey) || 0); } catch { /* Storage may be unavailable. */ }
    if (Date.now() - lastRecordedAt >= 30_000) {
      try { window.sessionStorage.setItem(pageKey, String(Date.now())); } catch { /* Server deduplication remains authoritative. */ }
      void recordProductEvent({ eventType: "page_view", locale, metadata: { page_path: pathname } });
    }
  }, [pathname, searchParams]);

  return null;
}

function readLocale(pathname: string): Locale {
  const candidate = pathname.split("/").filter(Boolean)[0];
  return locales.includes(candidate as Locale) ? candidate as Locale : defaultLocale;
}
