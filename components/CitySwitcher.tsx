"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { recordProductEvent } from "@/lib/place-events";
import { placeCities, placeCityLabels, type PlaceCity } from "@/lib/city-regions";
import { type Locale, withLocale } from "@/lib/i18n";

export function CitySwitcher({ locale, activeCity, path, counts }: { locale: Locale; activeCity: PlaceCity; path: "/places" | "/nearby"; counts?: Partial<Record<PlaceCity, number>> }) {
  const { user } = useAuth();
  const label = { ko: "도시 선택", zh: "选择城市", en: "Choose city", ja: "都市を選択" }[locale];
  return (
    <nav aria-label={label} className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {placeCities.map((city) => {
        const active = city.key === activeCity;
        return (
          <Link
            key={city.key}
            href={withLocale(`${path}?city=${city.key}`, locale)}
            onClick={() => {
              if (!active) void recordProductEvent({ eventType: "city_selected", locale, userId: user?.id, metadata: { city: city.key, surface: path.slice(1) } });
            }}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-black ring-1 transition ${active ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-slate-200 hover:bg-teal-50"}`}
          >
            <MapPin size={15} aria-hidden="true" />
            {placeCityLabels[city.key][locale]}
            {counts?.[city.key] !== undefined ? <span className={active ? "text-teal-100" : "text-slate-400"}>{counts[city.key]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
