"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { savedItemsStorageKey, type SavedItem } from "@/lib/saved-items";

export function SavedItemsView() {
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
  const items = useMemo(() => readItemsFromSnapshot(snapshot), [snapshot]);

  function removeItem(item: SavedItem) {
    const nextItems = items.filter((current) => !(current.id === item.id && current.type === item.type));
    window.localStorage.setItem(savedItemsStorageKey, JSON.stringify(nextItems));
    window.dispatchEvent(new Event("saved-items-change"));
  }

  if (items.length === 0) {
    return <EmptyState title="还没有收藏" description="저장한 장소와 사진스팟이 여기에 표시됩니다." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={`${item.type}-${item.id}`} className="grid grid-cols-[96px_1fr_auto] gap-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <Link href={item.href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
            <Image src={item.imageUrl} alt={item.titleZh} fill sizes="96px" className="object-cover" />
          </Link>
          <Link href={item.href} className="min-w-0 py-1">
            <p className="truncate text-base font-bold text-slate-950">{item.titleZh}</p>
            <p className="mt-1 truncate text-sm text-slate-500">{item.titleKo}</p>
            <p className="mt-3 text-xs font-semibold text-teal-700">{item.meta}</p>
          </Link>
          <button
            type="button"
            onClick={() => removeItem(item)}
            className="grid size-9 place-items-center rounded-full bg-rose-50 text-rose-700"
            aria-label="取消收藏"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </article>
      ))}
    </div>
  );
}

function readItemsFromSnapshot(snapshot: string) {
  try {
    return JSON.parse(snapshot) as SavedItem[];
  } catch {
    return [];
  }
}
