"use client";

import { TravelMap } from "@/components/TravelMap";
import { getPlaceContent, type Locale, withLocale } from "@/lib/i18n";
import { getPreferredMapProvider, type MapMarker } from "@/lib/map-provider";
import { categoryLabels, type TripPlaceWithPlace } from "@/types/database";

type TripDayMapProps = {
  items: TripPlaceWithPlace[];
  locale: Locale;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function TripDayMap({ items, locale, selectedId, onSelect }: TripDayMapProps) {
  const validItems = items.filter((item) => (
    typeof item.place.latitude === "number" && typeof item.place.longitude === "number"
  ));
  if (!validItems.length) return null;

  const center = {
    latitude: validItems.reduce((sum, item) => sum + Number(item.place.latitude), 0) / validItems.length,
    longitude: validItems.reduce((sum, item) => sum + Number(item.place.longitude), 0) / validItems.length,
  };
  const markers: MapMarker[] = validItems.map((item, index) => {
    const content = getPlaceContent(item.place, locale);
    return {
      id: item.place.id,
      title: content.name,
      subtitle: content.address,
      category: item.place.category,
      position: { latitude: Number(item.place.latitude), longitude: Number(item.place.longitude) },
      href: withLocale(`/places/${item.place.slug}`, locale),
      imageUrl: item.place.thumbnail_url,
      meta: categoryLabels[item.place.category][locale],
      sequence: index + 1,
    };
  });

  return (
    <div className="mt-3 h-[360px] overflow-hidden rounded-[24px]">
      <TravelMap
        center={center}
        markers={markers}
        provider={getPreferredMapProvider()}
        locale={locale}
        selectedId={selectedId}
        onSelectMarker={onSelect}
        className="h-full"
      />
    </div>
  );
}
