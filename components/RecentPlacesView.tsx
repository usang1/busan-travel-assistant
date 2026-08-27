"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/EmptyState";
import { readRecentPlaces, recentPlacesStorageKey, type RecentPlace } from "@/lib/recent-places";
import { defaultLocale, getLocaleFromPath, type Locale } from "@/lib/i18n";
import { categoryLabels } from "@/types/database";

type RecentPlacesViewProps = {
  locale?: Locale;
};

export function RecentPlacesView({ locale }: RecentPlacesViewProps) {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("recent-places-change", onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener("recent-places-change", onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => window.localStorage.getItem(recentPlacesStorageKey) ?? "[]",
    () => "[]",
  );
  const currentLocale = locale ?? (typeof window === "undefined" ? defaultLocale : getLocaleFromPath(window.location.pathname) ?? defaultLocale);
  const places = useMemo(() => readItemsFromSnapshot(snapshot), [snapshot]);

  if (places.length === 0) {
    return <EmptyState title="최근 본 장소가 없습니다" description="장소 상세를 열면 여기에 표시됩니다." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {places.map((place) => (
        <RecentPlaceCard key={place.id} place={place} locale={currentLocale} />
      ))}
    </div>
  );
}

function RecentPlaceCard({ place, locale }: { place: RecentPlace; locale: Locale }) {
  return (
    <article className="grid grid-cols-[82px_1fr] gap-3 rounded-[20px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <Link href={place.href} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
        <Image src={place.imageUrl} alt={place.title} fill sizes="82px" className="object-cover" />
      </Link>
      <Link href={place.href} className="min-w-0 py-1">
        <p className="truncate text-base font-black text-slate-950">{place.title}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{place.subtitle}</p>
        <p className="mt-3 text-xs font-semibold text-teal-700">{categoryLabels[place.category][locale]}</p>
      </Link>
    </article>
  );
}

function readItemsFromSnapshot(snapshot: string) {
  try {
    return JSON.parse(snapshot) as RecentPlace[];
  } catch {
    return readRecentPlaces();
  }
}
