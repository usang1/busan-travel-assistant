"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PlaceCard } from "@/components/PlaceCard";
import { SearchBar } from "@/components/SearchBar";
import { TagChip } from "@/components/TagChip";
import { categoryLabels, placeCategories, type PlaceCategory, type PlaceWithRelations } from "@/types/database";

type PlacesExplorerProps = {
  places: PlaceWithRelations[];
  initialCategory?: string;
};

const categoryFilters: Array<{ label: string; value: PlaceCategory | "all" }> = [
  { label: "全部", value: "all" },
  { label: "餐厅", value: "restaurant" },
  { label: "咖啡", value: "cafe" },
  { label: "酒吧", value: "bar" },
  { label: "景点", value: "attraction" },
  { label: "购物", value: "shopping" },
  { label: "拍照", value: "photo_spot" },
  { label: "行李", value: "luggage" },
];

const extraFilters = [
  { key: "solo", label: "一个人也可以", ko: "혼자 가능" },
  { key: "luggage", label: "行李OK", ko: "캐리어 가능" },
  { key: "chineseMenu", label: "中文菜单", ko: "중국어 메뉴" },
  { key: "under20000", label: "₩20,000 以下", ko: "2만원 이하" },
] as const;

type ExtraFilter = (typeof extraFilters)[number]["key"];

export function PlacesExplorer({ places, initialCategory }: PlacesExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "all">(
    placeCategories.includes(initialCategory as PlaceCategory) ? (initialCategory as PlaceCategory) : "all",
  );
  const [activeExtras, setActiveExtras] = useState<ExtraFilter[]>([]);

  const filteredPlaces = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    return places.filter((place) => {
      const categoryMatch = category === "all" || place.category === category;
      const searchText = [
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
  }, [activeExtras, category, places, query]);

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
          placeholder="搜索中文名、韩文名、说明、类别"
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
                {filter.label}
              </button>
            );
          })}
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200"
            aria-label="筛选"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {extraFilters.map((filter) => {
            const active = activeExtras.includes(filter.key);

            return (
              <button key={filter.key} type="button" onClick={() => toggleExtra(filter.key)} className="active:scale-95">
                <TagChip tone={active ? "green" : "default"}>{filter.label}</TagChip>
                <span className="sr-only">{filter.ko}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredPlaces.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {filteredPlaces.map((place, index) => (
            <PlaceCard key={place.id} place={place} priority={index === 0} />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title="没有找到地点" description="필터나 검색어를 줄여 다시 확인해 주세요." />
        </div>
      )}

      <p className="mt-4 text-center text-xs text-slate-500">
        当前显示 {filteredPlaces.length} / {places.length} 个地点 · 类别 {placeCategories.length} 个
      </p>
    </div>
  );
}
