import type { PlaceCategory } from "@/types/database";

export const recentPlacesStorageKey = "busan-travel-assistant-recent-places";

export type RecentPlace = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  imageUrl: string;
  category: PlaceCategory;
  viewedAt: string;
};

export function readRecentPlaces() {
  try {
    return JSON.parse(window.localStorage.getItem(recentPlacesStorageKey) ?? "[]") as RecentPlace[];
  } catch {
    return [];
  }
}

export function writeRecentPlace(place: Omit<RecentPlace, "viewedAt">) {
  const next = [
    { ...place, viewedAt: new Date().toISOString() },
    ...readRecentPlaces().filter((item) => item.id !== place.id),
  ].slice(0, 12);

  window.localStorage.setItem(recentPlacesStorageKey, JSON.stringify(next));
  window.dispatchEvent(new Event("recent-places-change"));
}
