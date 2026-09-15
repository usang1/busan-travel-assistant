import { type Locale, withLocale } from "@/lib/i18n";
import type { BusanDistrictKey } from "@/lib/busan-districts";

type SearchParamReader = Pick<URLSearchParams, "get">;

export function buildLocalizedPlacesSearchHref(locale: Locale, rawQuery: string, region?: BusanDistrictKey) {
  const trimmed = rawQuery.trim();
  const pathname = withLocale("/places", locale);

  if (!trimmed && !region) {
    return pathname;
  }

  const params = new URLSearchParams();
  if (trimmed) params.set("search", trimmed);
  if (region) params.set("region", region);
  return `${pathname}?${params.toString()}`;
}

export function readPlacesSearchQuery(searchParams: SearchParamReader) {
  return searchParams.get("search") ?? searchParams.get("q") ?? "";
}
