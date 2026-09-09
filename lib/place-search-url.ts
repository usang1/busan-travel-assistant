import { type Locale, withLocale } from "@/lib/i18n";

type SearchParamReader = Pick<URLSearchParams, "get">;

export function buildLocalizedPlacesSearchHref(locale: Locale, rawQuery: string) {
  const trimmed = rawQuery.trim();
  const pathname = withLocale("/places", locale);

  if (!trimmed) {
    return pathname;
  }

  const params = new URLSearchParams({ search: trimmed });
  return `${pathname}?${params.toString()}`;
}

export function readPlacesSearchQuery(searchParams: SearchParamReader) {
  return searchParams.get("search") ?? searchParams.get("q") ?? "";
}
