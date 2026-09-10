"use client";

import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { usePathname } from "next/navigation";
import { pricingCopy } from "@/lib/pricing-copy";
import { useProEntitlement } from "@/components/ProEntitlementProvider";
import { defaultLocale, getLocaleFromPath, localeMeta, withLocale } from "@/lib/i18n";

export function PricingClient() {
  const { isPro, entitlement, remainingDays } = useProEntitlement();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = pricingCopy[locale];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-teal-100 ring-1 ring-white/10">
          <Crown size={16} aria-hidden="true" />
          FREE / PRO
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {copy.description}
        </p>
        <div className="mt-5 rounded-[22px] bg-white/10 p-4">
          <p className="text-sm text-slate-300">{copy.status}</p>
          <p className="mt-1 text-2xl font-black">{isPro ? `PRO · ${copy.days}: ${remainingDays}` : "FREE"}</p>
          {entitlement ? <p className="mt-2 text-xs text-slate-300">{copy.expires}: {new Date(entitlement.expirationAt).toLocaleString(localeMeta[locale].languageTag)}</p> : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <FeatureBox title="FREE" items={copy.free} />
        <FeatureBox title="PRO" items={copy.pro} pro />
      </section>

      <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-black text-slate-950">{copy.pending}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {copy.note}
        </p>
        <Link href={withLocale("/contact", locale)} className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-teal-700 px-4 text-sm font-black text-white">
          {copy.contact}
        </Link>
      </section>
    </div>
  );
}

function FeatureBox({ title, items, pro = false }: { title: string; items: string[]; pro?: boolean }) {
  return (
    <div className={["rounded-[26px] p-5 shadow-sm ring-1", pro ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-950 ring-slate-200"].join(" ")}>
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm font-semibold">
            <Check size={16} aria-hidden="true" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
