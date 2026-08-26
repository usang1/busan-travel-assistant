"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Luggage, MapPin, Search, WalletCards, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import { defaultLocale, getPlaceContent, type Locale, ui, withLocale } from "@/lib/i18n";
import { formatPriceRange } from "@/lib/place-store";
import { categoryLabels, type PlaceWithRelations } from "@/types/database";

type LuggageExplorerProps = {
  places: PlaceWithRelations[];
  locale?: Locale;
};

export function LuggageExplorer({ places, locale = defaultLocale }: LuggageExplorerProps) {
  const [query, setQuery] = useState("");
  const copy = ui[locale];

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    return [...places]
      .sort((a, b) => a.walking_minutes - b.walking_minutes)
      .filter((place) => {
        const content = getPlaceContent(place, locale);

        if (!lowered) {
          return true;
        }

        return [content.name, content.secondaryName, content.address, place.name_zh, place.name_ko, place.address_zh, place.address_ko, place.nearest_station]
          .join(" ")
          .toLowerCase()
          .includes(lowered);
      });
  }, [locale, places, query]);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">搜索行李寄存</span>
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索寄存点、车站、地址"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[16px] text-slate-900 shadow-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        />
      </label>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <TagChip tone="green">거리순</TagChip>
        <TagChip tone="blue">大行李箱</TagChip>
        <TagChip tone="amber">价格/时间 확인</TagChip>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 space-y-4">
          {filtered.map((place) => (
            <article key={place.id} className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200">
              <div className="grid grid-cols-[112px_1fr] gap-0">
                <Link href={withLocale(`/places/${place.slug}`, locale)} className="relative min-h-40 bg-slate-200">
                  <Image src={place.thumbnail_url} alt={getPlaceContent(place, locale).name} fill sizes="112px" className="object-cover" />
                </Link>
                <div className="min-w-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={withLocale(`/places/${place.slug}`, locale)} className="min-w-0">
                      <h2 className="truncate text-lg font-black text-slate-950">{getPlaceContent(place, locale).name}</h2>
                      <p className="mt-1 truncate text-sm text-slate-500">{getPlaceContent(place, locale).secondaryName}</p>
                    </Link>
                    <SaveButton
                      item={{
                        id: place.id,
                        type: "place",
                        titleZh: place.name_zh,
                        titleKo: place.name_ko,
                        href: withLocale(`/places/${place.slug}`, locale),
                        imageUrl: place.thumbnail_url,
                        meta: `${categoryLabels.luggage[locale]} · ${copy.common.walk} ${place.walking_minutes}${copy.common.minutes}`,
                      }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Info icon={MapPin} label="位置" value={`${place.nearest_station} ${place.nearest_exit}`} />
                    <Info icon={Clock3} label="运营" value={place.opening_hours || copy.common.notRegistered} />
                    <Info icon={WalletCards} label="价格" value={formatPriceRange(place, locale)} />
                    <Info icon={Luggage} label="大行李箱" value={place.luggage_friendly ? "可以" : "需确认"} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-teal-700">{copy.common.walk} {place.walking_minutes}{copy.common.minutes}</p>
                  <p className="mt-1 text-xs text-slate-500">최대 보관시간: 당일 영업시간 내 확인 필요</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title="没有找到寄存点" description="검색어를 줄여 다시 확인해 주세요." />
        </div>
      )}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <Icon size={15} className="text-teal-700" aria-hidden="true" />
      <p className="mt-1 text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 font-bold text-slate-950">{value}</p>
    </div>
  );
}
