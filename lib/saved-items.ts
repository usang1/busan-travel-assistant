export type SavedItemType = "place" | "photo_spot";

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
