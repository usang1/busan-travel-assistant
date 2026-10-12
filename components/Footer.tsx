"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { defaultLocale, getLocaleFromPath, ui, withLocale, withoutLocale } from "@/lib/i18n";

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

  if (withoutLocale(pathname) === "/") return null;

  return (
    <footer className="mx-auto max-w-7xl px-4 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-16 text-sm text-[#6f746e] md:pb-8">
      <div className="border-t border-[#e8e4dd] py-8">
        <p className="text-lg font-black tracking-[-0.03em] text-[#252824]">{copy.siteName}</p>
        <p className="mt-2 leading-6">{copy.siteDescription}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={withLocale(link.href, locale)}
              className="flex min-h-11 items-center break-words border-b border-[#e8e4dd] px-1 py-3 text-[#555b55] transition hover:text-[#4f6652]"
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
