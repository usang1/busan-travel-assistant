"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import type { PhotoSpotRecord } from "@/types/database";
import { defaultLocale, withLocale, type Locale } from "@/lib/i18n";
import { photoSpotCopy } from "@/lib/photo-spot-copy";

export function PhotoSpotDetailGate({ photoSpot, children, locale = defaultLocale }: { photoSpot: PhotoSpotRecord; children: React.ReactNode; locale?: Locale }) {
  const copy = photoSpotCopy[locale];
  const { isPro } = useProEntitlement();
  const locked = photoSpot.free_or_pro === "pro" && !isPro;

  if (!locked) {
    return children;
  }

  return (
    <section className="rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-950 text-white">
        <Lock size={26} aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-black text-slate-950">{copy.locked}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {copy.lockedDescription}
      </p>
      <Link href={withLocale("/contact", locale)} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-teal-700 px-4 font-black text-white">
        {copy.contact}
      </Link>
    </section>
  );
}
