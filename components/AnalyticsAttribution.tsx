"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureSessionAttribution } from "@/lib/analytics-source";

export function AnalyticsAttribution() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureSessionAttribution();
  }, [pathname, searchParams]);

  return null;
}
