"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { SaveButton } from "@/components/SaveButton";
import { getPlaceContent, type Locale, withLocale } from "@/lib/i18n";
import { getPlaceCategoryLabel } from "@/lib/place-trust";
import type { Coordinates } from "@/lib/location";
import type { PlaceWithRelations } from "@/types/database";

export function PlaceMobileActions({ place, locale, coordinates, imageUrl }: { place: PlaceWithRelations; locale: Locale; coordinates: Coordinates | null; imageUrl: string }) {
  const content = getPlaceContent(place, locale);
  const [copied, setCopied] = useState(false);
  const text = {
    zh: { copy: "复制韩文地址", copied: "已复制" }, en: { copy: "Copy Korean address", copied: "Copied" },
    ja: { copy: "韓国語住所をコピー", copied: "コピー済み" }, ko: { copy: "주소 복사", copied: "복사됨" },
  }[locale];

  async function copyAddress() {
    if (!place.address_ko.trim() || !navigator.clipboard) return;
    await navigator.clipboard.writeText(place.address_ko.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="fixed inset-x-3 bottom-[72px] z-40 grid grid-cols-[auto_1fr_auto] gap-2 rounded-2xl bg-white/95 p-2 shadow-2xl ring-1 ring-slate-200 backdrop-blur md:hidden" aria-label={content.name}>
      <SaveButton
        initialSaveCount={place.save_count ?? 0}
        locale={locale}
        item={{ id: place.id, type: "place", titleZh: place.name_zh, titleKo: place.name_ko, href: withLocale(`/places/${place.slug}`, locale), imageUrl, meta: getPlaceCategoryLabel(place.category, locale) }}
      />
      <button type="button" onClick={() => void copyAddress()} disabled={!place.address_ko.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-800 disabled:opacity-50">
        <Copy size={16} aria-hidden="true" />{copied ? text.copied : text.copy}
      </button>
      <DirectionsButton placeId={place.id} name={content.name} address={place.address_ko} coordinates={coordinates} locale={locale} compact />
    </div>
  );
}
