import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import { formatPriceRange } from "@/lib/place-store";
import { categoryLabels, type PlaceWithRelations } from "@/types/database";

type PlaceCardProps = {
  place: PlaceWithRelations;
  priority?: boolean;
};

export function PlaceCard({ place, priority = false }: PlaceCardProps) {
  return (
    <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/places/${place.slug}`} className="block">
        <div className="relative aspect-[16/10] bg-slate-200">
          <Image
            src={place.thumbnail_url}
            alt={`${place.name_zh} / ${place.name_ko}`}
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
            priority={priority}
          />
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
            {categoryLabels[place.category].zh}
          </div>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/places/${place.slug}`} className="min-w-0">
            <h3 className="truncate text-lg font-bold text-slate-950">{place.name_zh}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{place.name_ko}</p>
          </Link>
          <SaveButton
            item={{
              id: place.id,
              type: "place",
              titleZh: place.name_zh,
              titleKo: place.name_ko,
              href: `/places/${place.slug}`,
              imageUrl: place.thumbnail_url,
              meta: `${categoryLabels[place.category].zh} · 步行 ${place.walking_minutes}分钟`,
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">人均 {formatPriceRange(place)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} aria-hidden="true" />
            步行 {place.walking_minutes}分钟
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} aria-hidden="true" />
            {place.nearest_station}
          </span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{place.short_description_zh}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {place.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag.slug} tone={place.is_active ? "green" : "amber"}>
              {tag.label_zh}
            </TagChip>
          ))}
        </div>
      </div>
    </article>
  );
}
