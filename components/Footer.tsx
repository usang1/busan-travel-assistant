"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { defaultLocale, getLocaleFromPath, ui, withLocale } from "@/lib/i18n";

const legalLinks = [
  { href: "/service-info", key: "serviceInfo" },
  { href: "/privacy", key: "privacy" },
  { href: "/terms", key: "terms" },
  { href: "/contact", key: "contact" },
] as const;

export function Footer() {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = ui[locale];

  return (
    <footer className="mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-10 text-sm text-slate-500">
      <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="font-black text-slate-950">{copy.siteName}</p>
        <p className="mt-2 leading-6">{copy.siteDescription}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={withLocale(link.href, locale)}
              className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-700 transition hover:bg-slate-100"
            >
              <span className="block font-bold">{copy.footerLinks[link.key]}</span>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-400">{copy.footerNote}</p>
      </div>
    </footer>
  );
}
