"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import type { PhotoSpotRecord } from "@/types/database";

export function PhotoSpotDetailGate({ photoSpot, children }: { photoSpot: PhotoSpotRecord; children: React.ReactNode }) {
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
      <h1 className="mt-5 text-2xl font-black text-slate-950">这个拍照点是 PRO</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        PRO 可查看全部照片点、完整拍照提示和详细站位。무료 사용자는 일부 사진스팟만 볼 수 있습니다.
      </p>
      <Link href="/pricing" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-teal-700 px-4 font-black text-white">
        解锁 PRO
      </Link>
    </section>
  );
}
