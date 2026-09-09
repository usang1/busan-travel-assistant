export type SavedItemType = "place" | "photo_spot" | "guide";

export type SavedItem = {
  id: string;
  type: SavedItemType;
  titleZh: string;
  titleKo: string;
  href: string;
  imageUrl: string;
  meta: string;
  savedAt: string;
};

export const savedItemsStorageKey = "busan-travel-assistant-saved-items";

export const savedItemsChangeEvent = "saved-items-change";

export function readSavedItems(): SavedItem[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedItemsStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSavedItem) : [];
  } catch {
    return [];
  }
}

export function writeSavedItems(items: SavedItem[]) {
  if (typeof window === "undefined") return;

  const deduped = dedupeSavedItems(items);
  window.localStorage.setItem(savedItemsStorageKey, JSON.stringify(deduped));
  window.dispatchEvent(new Event(savedItemsChangeEvent));
}

export function clearSavedItems() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(savedItemsStorageKey);
  window.dispatchEvent(new Event(savedItemsChangeEvent));
}

export function getSavedPlaceIds() {
  return readSavedItems()
    .filter((item) => item.type === "place")
    .map((item) => item.id);
}

export function getSavedGuideIds() {
  return readSavedItems()
    .filter((item) => item.type === "guide")
    .map((item) => item.id);
}

export function isItemSaved(item: Pick<SavedItem, "id" | "type">) {
  return readSavedItems().some((savedItem) => savedItem.id === item.id && savedItem.type === item.type);
}

export function toggleSavedItem(item: Omit<SavedItem, "savedAt">) {
  const current = readSavedItems();
  const exists = current.some((savedItem) => savedItem.id === item.id && savedItem.type === item.type);

  if (exists) {
    const next = current.filter((savedItem) => !(savedItem.id === item.id && savedItem.type === item.type));
    writeSavedItems(next);
    return { saved: false, items: next };
  }

  const next = [{ ...item, savedAt: new Date().toISOString() }, ...current];
  writeSavedItems(next);
  return { saved: true, items: dedupeSavedItems(next) };
}

export function removeSavedItem(item: Pick<SavedItem, "id" | "type">) {
  const next = readSavedItems().filter((savedItem) => !(savedItem.id === item.id && savedItem.type === item.type));
  writeSavedItems(next);
  return next;
}

export function dedupeSavedItems(items: SavedItem[]) {
  const seen = new Set<string>();
  const deduped: SavedItem[] = [];

  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function isSavedItem(value: unknown): value is SavedItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedItem>;

  return (
    typeof item.id === "string" &&
    (item.type === "place" || item.type === "photo_spot" || item.type === "guide") &&
    typeof item.titleZh === "string" &&
    typeof item.titleKo === "string" &&
    typeof item.href === "string" &&
    typeof item.imageUrl === "string" &&
    typeof item.meta === "string" &&
    typeof item.savedAt === "string"
  );
}
