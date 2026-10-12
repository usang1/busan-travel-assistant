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
    <section className="border border-[#e8e4dd] bg-white p-5 shadow-[0_18px_50px_rgba(37,40,36,0.06)] sm:p-7">
      <h2 className="text-xl font-black tracking-[-0.03em] text-[#252824]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6f746e]">{description}</p>
      <Link
        href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(pathname)}`}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 bg-[#4f6652] px-4 text-sm font-black text-white transition hover:bg-[#405444] active:scale-95"
      >
        <LogIn size={17} aria-hidden="true" />
        {copy.auth.login}
      </Link>
    </section>
  );
}
