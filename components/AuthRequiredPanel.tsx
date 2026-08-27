"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { usePathname } from "next/navigation";
import { defaultLocale, getLocaleFromPath, type Locale, ui, withLocale } from "@/lib/i18n";

type AuthRequiredPanelProps = {
  title: string;
  description: string;
  locale?: Locale;
};

export function AuthRequiredPanel({ title, description, locale }: AuthRequiredPanelProps) {
  const pathname = usePathname();
  const currentLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = ui[currentLocale];

  return (
    <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <Link
        href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(pathname)}`}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
      >
        <LogIn size={17} aria-hidden="true" />
        {copy.auth.login}
      </Link>
    </section>
  );
}
