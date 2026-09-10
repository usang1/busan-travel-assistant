"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, Clock3, Lock, ZoomIn } from "lucide-react";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import { defaultLocale, type Locale, withLocale } from "@/lib/i18n";
import type { PhotoSpotRecord } from "@/types/database";

type PhotoSpotCardProps = {
  spot: PhotoSpotRecord;
  priority?: boolean;
  locale?: Locale;
};

const labels: Record<Locale, { inquire: string; bestTime: string; locked: string; originalName: string; tipPending: string }> = {
  zh: { inquire: "咨询", bestTime: "最佳时间", locked: "PRO 可查看完整拍照提示和详细站位。", originalName: "韩文原名", tipPending: "拍照提示准备中。" },
  en: { inquire: "Contact", bestTime: "Best time", locked: "Pro access includes full photo tips and detailed positions.", originalName: "Korean original name", tipPending: "Photo tip copy is being prepared." },
  ja: { inquire: "問い合わせ", bestTime: "おすすめ時間", locked: "Pro では撮影のヒントと詳しい立ち位置を確認できます。", originalName: "韓国語原名", tipPending: "撮影ヒントを準備中です。" },
  ko: { inquire: "문의", bestTime: "추천 시간", locked: "Pro에서 전체 촬영 팁과 자세한 위치를 확인할 수 있습니다.", originalName: "중국어명", tipPending: "촬영 팁을 준비 중입니다." },
};

export function PhotoSpotCard({ spot, priority = false, locale = defaultLocale }: PhotoSpotCardProps) {
  const { isPro } = useProEntitlement();
  const locked = spot.free_or_pro === "pro" && !isPro;
  const href = locked ? withLocale("/contact", locale) : withLocale(`/photo-spots/${spot.slug}`, locale);
  const displayName = locale === "zh" ? spot.name_zh || spot.name_ko : spot.name_ko;
  const secondaryName = locale === "zh" ? spot.name_ko : "";
  const copy = labels[locale];
  const description = locked ? copy.locked : locale === "zh" ? spot.portrait_tip_zh : copy.tipPending;

  return (
    <article className={["overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200", locked ? "opacity-90" : ""].join(" ")}>
      <Link href={href} className="block">
        <div className="relative aspect-[16/10] bg-slate-200">
          <Image
            src={spot.thumbnail_url}
            alt={displayName}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority={priority}
          />
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
            {locked ? <Lock size={14} aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
            {spot.free_or_pro === "free" ? "Free" : "Pro"}
          </div>
          {locked ? <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]" /> : null}
        </div>
      </Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={href} className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-950">{displayName}</h2>
            {locale !== "ko" ? <p className="mt-1 break-words text-sm text-slate-500">{copy.originalName}{secondaryName ? ` · ${secondaryName}` : ""}</p> : null}
          </Link>
          {locked ? (
            <Link href={withLocale("/contact", locale)} className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">
              {copy.inquire}
            </Link>
          ) : (
            <SaveButton
              item={{
                id: spot.id,
                type: "photo_spot",
                titleZh: spot.name_zh,
                titleKo: spot.name_ko,
                href,
                imageUrl: spot.thumbnail_url,
                meta: `${copy.bestTime} · ${spot.best_time}`,
              }}
            />
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <TagChip tone="blue">
            <Clock3 size={13} aria-hidden="true" /> {spot.best_time}
          </TagChip>
          <TagChip tone="green">
            <ZoomIn size={13} aria-hidden="true" /> {spot.recommended_zoom}
          </TagChip>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </article>
  );
}
