"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
import { savedItemsStorageKey, type SavedItem } from "@/lib/saved-items";
import { cn } from "@/lib/utils";

type SaveButtonProps = {
  item: Omit<SavedItem, "savedAt">;
  className?: string;
  label?: string;
};

function readItems() {
  try {
    return JSON.parse(window.localStorage.getItem(savedItemsStorageKey) ?? "[]") as SavedItem[];
  } catch {
    return [];
  }
}

function writeItems(items: SavedItem[]) {
  window.localStorage.setItem(savedItemsStorageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("saved-items-change"));
}

export function SaveButton({ item, className, label }: SaveButtonProps) {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("saved-items-change", onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener("saved-items-change", onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => window.localStorage.getItem(savedItemsStorageKey) ?? "[]",
    () => "[]",
  );
  const items = useMemo(() => {
    try {
      return JSON.parse(snapshot) as SavedItem[];
    } catch {
      return [];
    }
  }, [snapshot]);
  const saved = items.some((savedItem) => savedItem.id === item.id && savedItem.type === item.type);

  function toggleSaved() {
    const current = readItems();
    const exists = current.some((savedItem) => savedItem.id === item.id && savedItem.type === item.type);

    if (exists) {
      writeItems(current.filter((savedItem) => !(savedItem.id === item.id && savedItem.type === item.type)));
      return;
    }

    writeItems([{ ...item, savedAt: new Date().toISOString() }, ...current]);
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200 transition hover:bg-teal-50 hover:text-teal-700 active:scale-95",
        className ?? "size-10",
        saved && "bg-teal-50 text-teal-700 ring-teal-100",
      )}
      aria-pressed={saved}
      aria-label={`${saved ? "取消收藏" : "收藏"} ${item.titleZh}`}
    >
      <Bookmark size={18} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      {label ? <span>{saved ? "已收藏" : label}</span> : null}
    </button>
  );
}
