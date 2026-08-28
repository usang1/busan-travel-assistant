"use client";

import Link from "next/link";
import { Flag, Languages, LogIn, LogOut, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { defaultLocale, getLocaleFromPath, localeMeta, locales, ui, withLocale, withoutLocale } from "@/lib/i18n";
import { getSupabaseClient } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = ui[currentLocale];
  const basePath = withoutLocale(pathname);
  const queryString = searchParams.toString();
  const querySuffix = queryString ? `?${queryString}` : "";
  const { user, isAdmin } = useAuth();

  async function signOut() {
    const client = getSupabaseClient();

    if (!client) {
      return;
    }

    await client.auth.signOut();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href={withLocale("/", currentLocale)} className="flex min-w-0 flex-1 items-center gap-2" aria-label={`${copy.siteName} ${copy.nav.home}`}>
          <span className="grid size-9 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-950">{copy.siteName}</span>
            <span className="block text-[11px] text-slate-500">Busan Travel Assistant</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <div className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 sm:flex">
            <MapPin size={15} className="text-teal-700" aria-hidden="true" />
            {copy.region}
          </div>
          {user ? (
            <>
              <Link
                href={withLocale("/mypage", currentLocale)}
                className="hidden h-9 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95 sm:inline-flex"
              >
                <UserRound size={16} aria-hidden="true" />
                {copy.auth.mypage}
              </Link>
              {isAdmin ? (
                <Link
                  href={withLocale("/admin", currentLocale)}
                  className="hidden h-9 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-95 sm:inline-flex"
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  {copy.auth.admin}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95"
                aria-label={copy.auth.logout}
                title={copy.auth.logout}
              >
                <LogOut size={16} aria-hidden="true" />
                <span className="whitespace-nowrap">{copy.auth.logout}</span>
              </button>
            </>
          ) : (
            <Link
              href={`${withLocale("/login", currentLocale)}?next=${encodeURIComponent(`${pathname}${querySuffix}`)}`}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95"
              aria-label={copy.auth.login}
              title={copy.auth.login}
            >
              <LogIn size={16} aria-hidden="true" />
              <span className="whitespace-nowrap">{copy.auth.login}</span>
            </Link>
          )}
          <Link
            href={withLocale("/contact", currentLocale)}
            className="hidden h-9 items-center justify-center gap-1.5 rounded-full bg-teal-700 px-3 text-sm font-black text-white shadow-sm transition hover:bg-teal-800 active:scale-95 sm:inline-flex"
          >
            <Flag size={16} aria-hidden="true" />
            {copy.common.submitPlace}
          </Link>
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200" aria-label="Language">
            <Languages size={15} className="ml-2 text-slate-500" aria-hidden="true" />
            {locales.map((locale) => (
              <Link
                key={locale}
                href={`${withLocale(basePath, locale)}${querySuffix}`}
                hrefLang={localeMeta[locale].languageTag}
                className={[
                  "rounded-full px-2 py-1 text-xs font-black transition",
                  currentLocale === locale
                    ? "bg-teal-700 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
                aria-label={localeMeta[locale].label}
              >
                {locale.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
