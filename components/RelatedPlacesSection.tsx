import { PlaceCard } from "@/components/PlaceCard";
import type { Locale } from "@/lib/i18n";
import type { PlaceWithRelations } from "@/types/database";

const titles: Record<Locale, string> = {
  ko: "여기까지 왔다면 같이 가기 좋아요",
  zh: "来到这里，也适合顺路去",
  en: "Good places to combine with this visit",
  ja: "ここまで来たら一緒に立ち寄りたい場所",
};

export function RelatedPlacesSection({ places, locale }: { places: PlaceWithRelations[]; locale: Locale }) {
  if (!places.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-black text-slate-950">{titles[locale]}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {places.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            locale={locale}
            compact
            distanceMeters={place.recommendation_distance ?? null}
          />
        ))}
      </div>
    </section>
  );
}
