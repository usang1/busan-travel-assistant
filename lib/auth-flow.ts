import type { Locale } from "@/lib/i18n";

export const pendingPlaceSaveStorageKey = "busan-travel-assistant-pending-place-save";

export type PendingPlaceSave = {
  placeId: string;
  locale: Locale;
  createdAt: string;
};

export function getSafeNextPath(value: string | null, fallback: string) {
  // Browsers normalize backslashes and strip control characters when parsing
  // URLs. Validate the parsed destination as well as its original spelling.
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return fallback;
  }

  try {
    const origin = "https://spotzari.invalid";
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
