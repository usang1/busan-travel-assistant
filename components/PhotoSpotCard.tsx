"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, Clock3, Lock, ZoomIn } from "lucide-react";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { SaveButton } from "@/components/SaveButton";
import { TagChip } from "@/components/TagChip";
import type { PhotoSpotRecord } from "@/types/database";

type PhotoSpotCardProps = {
  spot: PhotoSpotRecord;
  priority?: boolean;
};

export function PhotoSpotCard({ spot, priority = false }: PhotoSpotCardProps) {
  const { isPro } = useProEntitlement();
  const locked = spot.free_or_pro === "pro" && !isPro;
  const href = locked ? "/pricing" : `/photo-spots/${spot.slug}`;

  return (
    <article className={["overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200", locked ? "opacity-90" : ""].join(" ")}>
      <Link href={href} className="block">
        <div className="relative aspect-[16/10] bg-slate-200">
          <Image
            src={spot.thumbnail_url}
            alt={spot.name_zh}
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
            <h2 className="truncate text-xl font-bold text-slate-950">{spot.name_zh}</h2>
            <p className="mt-1 truncate text-sm text-slate-500">{spot.name_ko}</p>
          </Link>
          {locked ? (
            <Link href="/pricing" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white">
              解锁
            </Link>
          ) : (
            <SaveButton
              item={{
                id: spot.id,
                type: "photo_spot",
                titleZh: spot.name_zh,
                titleKo: spot.name_ko,
                href: `/photo-spots/${spot.slug}`,
                imageUrl: spot.thumbnail_url,
                meta: `最佳时间 · ${spot.best_time}`,
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
          {locked ? "PRO 可查看完整拍照提示和详细站位。" : spot.portrait_tip_zh}
        </p>
      </div>
    </article>
  );
}
