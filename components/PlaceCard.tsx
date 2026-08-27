import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import { formatDistance, formatOpeningStatus, type Coordinates } from "@/lib/location";
import { formatPriceRange } from "@/lib/place-store";
import { defaultLocale, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { categoryLabels, type PlaceWithRelations } from "@/types/database";

type PlaceCardProps = {
  place: PlaceWithRelations;
  priority?: boolean;
  locale?: Locale;
  distanceMeters?: number | null;
  compact?: boolean;
};

export function PlaceCard({ place, priority = false, locale = defaultLocale, distanceMeters = null, compact = false }: PlaceCardProps) {
  const content = getPlaceContent(place, locale);
  const copy = ui[locale];
  const placeHref = withLocale(`/places/${place.slug}`, locale);
  const opening = formatOpeningStatus(place.opening_hours, locale);
  const coordinates: Coordinates | null =
    typeof place.latitude === "number" && typeof place.longitude === "number"
      ? { latitude: place.latitude, longitude: place.longitude }
      : null;

  return (
    <article className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={placeHref} className="block">
        <div className="relative aspect-[16/10] bg-slate-200">
          <Image
            src={place.thumbnail_url}
            alt={`${content.name} / ${content.secondaryName}`}
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
            priority={priority}
          />
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
            {categoryLabels[place.category][locale]}
          </div>
        </div>
      </Link>
      <div className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between gap-3">
          <Link href={placeHref} className="min-w-0">
            <h3 className={compact ? "truncate text-base font-bold text-slate-950" : "truncate text-lg font-bold text-slate-950"}>{content.name}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{content.secondaryName}</p>
          </Link>
          <SaveButton
            initialSaveCount={place.save_count ?? 0}
            locale={locale}
            item={{
              id: place.id,
              type: "place",
              titleZh: place.name_zh,
              titleKo: place.name_ko,
              href: placeHref,
              imageUrl: place.thumbnail_url,
              meta: `${categoryLabels[place.category][locale]} · ${copy.common.walk} ${place.walking_minutes}${copy.common.minutes}`,
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{copy.common.perPerson} {formatPriceRange(place, locale)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 size={14} aria-hidden="true" />
            {copy.common.walk} {place.walking_minutes}{copy.common.minutes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} aria-hidden="true" />
            {place.nearest_station}
          </span>
          {distanceMeters !== null ? <span className="font-semibold text-teal-700">{formatDistance(distanceMeters)}</span> : null}
        </div>
        {place.opening_hours ? (
          <div className="mt-3">
            <TagChip tone={opening.tone}>{opening.text}</TagChip>
          </div>
        ) : null}
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{content.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {place.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag.slug} tone={place.is_active ? "green" : "amber"}>
              {locale === "ko" ? tag.label_ko : tag.label_zh}
            </TagChip>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <DirectionsButton
            placeId={place.id}
            name={content.name}
            address={content.address}
            coordinates={coordinates}
            locale={locale}
            compact
          />
        </div>
      </div>
    </article>
  );
}
