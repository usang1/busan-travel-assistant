"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { SearchBar } from "@/components/SearchBar";
import { TagChip } from "@/components/TagChip";
import { defaultLocale, getPlaceContent, type Locale, ui } from "@/lib/i18n";
import { categoryLabels, placeCategories, type PlaceCategory, type PlaceWithRelations } from "@/types/database";

type PlacesExplorerProps = {
  places: PlaceWithRelations[];
  initialCategory?: string;
  locale?: Locale;
};

const categoryFilters: Array<{ value: PlaceCategory | "all" }> = [
  { value: "all" },
  { value: "restaurant" },
  { value: "cafe" },
  { value: "bar" },
  { value: "attraction" },
  { value: "shopping" },
  { value: "photo_spot" },
  { value: "luggage" },
];

const extraFilters = [
  {
    key: "solo",
    label: { zh: "一个人也可以", en: "Solo friendly", ja: "一人でもOK", ko: "혼자 가능" },
  },
  {
    key: "luggage",
    label: { zh: "行李OK", en: "Luggage OK", ja: "荷物OK", ko: "캐리어 가능" },
  },
  {
    key: "chineseMenu",
    label: { zh: "中文菜单", en: "Chinese menu", ja: "中国語メニュー", ko: "중국어 메뉴" },
  },
  {
    key: "under20000",
    label: { zh: "₩20,000 以下", en: "Under ₩20,000", ja: "₩20,000以下", ko: "2만원 이하" },
  },
] as const;

type ExtraFilter = (typeof extraFilters)[number]["key"];

export function PlacesExplorer({ places, initialCategory, locale = defaultLocale }: PlacesExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "all">(
    placeCategories.includes(initialCategory as PlaceCategory) ? (initialCategory as PlaceCategory) : "all",
  );
  const [activeExtras, setActiveExtras] = useState<ExtraFilter[]>([]);
  const copy = ui[locale];

  const filteredPlaces = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    return places.filter((place) => {
      const content = getPlaceContent(place, locale);
      const categoryMatch = category === "all" || place.category === category;
      const searchText = [
        content.name,
        content.secondaryName,
        content.description,
        place.name_zh,
        place.name_ko,
        place.short_description_zh,
        place.short_description_ko,
        categoryLabels[place.category].zh,
        categoryLabels[place.category].ko,
        ...place.tags.map((tag) => `${tag.label_zh} ${tag.label_ko}`),
      ]
        .join(" ")
        .toLowerCase();

      const queryMatch = lowered.length === 0 || searchText.includes(lowered);
      const extraMatch = activeExtras.every((filter) => {
        if (filter === "solo") {
          return place.solo_friendly;
        }

        if (filter === "luggage") {
          return place.luggage_friendly;
        }

        if (filter === "chineseMenu") {
          return place.chinese_menu;
        }

        return (place.price_min ?? place.price_max ?? Number.MAX_SAFE_INTEGER) <= 20000;
      });

      return categoryMatch && queryMatch && extraMatch;
    });
  }, [activeExtras, category, locale, places, query]);

  function toggleExtra(filter: ExtraFilter) {
    setActiveExtras((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
  }

  return (
    <div>
      <div className="space-y-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={copy.places.searchPlaceholder}
          compact
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoryFilters.map((filter) => {
            const active = category === filter.value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setCategory(filter.value)}
                className={[
                  "shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition active:scale-95",
                  active
                    ? "bg-slate-950 text-white ring-slate-950"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {filter.value === "all" ? copy.places.all : categoryLabels[filter.value][locale]}
              </button>
            );
          })}
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200"
            aria-label={copy.places.filter}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {extraFilters.map((filter) => {
            const active = activeExtras.includes(filter.key);

            return (
              <button key={filter.key} type="button" onClick={() => toggleExtra(filter.key)} className="active:scale-95">
                <TagChip tone={active ? "green" : "default"}>{filter.label[locale]}</TagChip>
              </button>
            );
          })}
        </div>
      </div>

      {filteredPlaces.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {filteredPlaces.map((place, index) => (
            <PlaceCard key={place.id} place={place} priority={index === 0} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title={copy.places.emptyTitle} description={copy.places.emptyDescription} />
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-500">
        {copy.places.countLabel} {filteredPlaces.length} / {places.length} · {placeCategories.length}
      </p>
    </div>
  );
}
