"use client";

import { useEffect, useState } from "react";
import { PlaceCard } from "@/components/PlaceCard";
import type { Coordinates } from "@/lib/location";
import type { Locale } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

const copy = {
  ko: { title: "내 주변 인기 장소", loading: "주변 인기 장소를 찾는 중입니다.", empty: "3km 안에서 저장된 장소를 아직 찾지 못했습니다." },
  zh: { title: "我附近的热门地点", loading: "正在查找附近的热门地点。", empty: "3公里内暂未找到有收藏记录的地点。" },
  en: { title: "Popular near me", loading: "Finding popular places nearby.", empty: "No saved places were found within 3 km yet." },
  ja: { title: "現在地周辺の人気スポット", loading: "周辺の人気スポットを検索しています。", empty: "3km以内に保存された場所はまだありません。" },
} satisfies Record<Locale, { title: string; loading: string; empty: string }>;

export function NearbyPopularPlaces({ origin, locale }: { origin: Coordinates; locale: Locale }) {
  const [places, setPlaces] = useState<PlaceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const text = copy[locale];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    void fetch(`/api/places/recommendations?latitude=${origin.latitude}&longitude=${origin.longitude}&limit=4`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("nearby recommendations failed");
        return response.json() as Promise<{ places?: PlaceWithRelations[] }>;
      })
      .then((body) => setPlaces(body.places ?? []))
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setPlaces([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [origin.latitude, origin.longitude]);

  return (
    <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-black text-slate-950">{text.title}</h2>
      {loading ? <p className="mt-3 text-sm font-semibold text-slate-500">{text.loading}</p> : null}
      {!loading && !places.length ? <p className="mt-3 text-sm font-semibold text-slate-500">{text.empty}</p> : null}
      {places.length ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {places.map((place) => (
            <div key={place.id} className="w-[280px] shrink-0 sm:w-[320px]">
              <PlaceCard place={place} locale={locale} compact distanceMeters={place.recommendation_distance ?? null} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
