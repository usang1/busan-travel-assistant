import type { Locale } from "@/lib/i18n";

export const pendingPlaceSaveStorageKey = "busan-travel-assistant-pending-place-save";

export type PendingPlaceSave = {
  placeId: string;
  locale: Locale;
  createdAt: string;
};

export function getSafeNextPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
