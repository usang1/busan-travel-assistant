"use client";

import Link from "next/link";
import { Languages, LogIn, LogOut, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { defaultLocale, getLocaleFromPath, localeMeta, locales, ui, withLocale, withoutLocale } from "@/lib/i18n";
import { getSupabaseClient } from "@/lib/supabase";
import { guideCopy } from "@/lib/guide-copy";

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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href={withLocale("/", currentLocale)} className="flex min-h-11 min-w-[160px] flex-1 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-950">{copy.siteName}</span>
            <span className="block text-[11px] text-slate-500">Korea Travel Assistant</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <div className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 sm:flex">
            <MapPin size={15} className="text-teal-700" aria-hidden="true" />
            {copy.region}
          </div>
          {user ? (
            <>
              <Link
                href={withLocale("/mypage", currentLocale)}
                className="hidden h-11 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95 sm:inline-flex"
              >
                <UserRound size={16} aria-hidden="true" />
                {copy.auth.mypage}
              </Link>
              {isAdmin ? (
                <Link
                  href={withLocale("/admin", currentLocale)}
                  className="hidden h-11 items-center justify-center gap-1.5 rounded-full bg-slate-950 px-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 active:scale-95 sm:inline-flex"
                >
                  <ShieldCheck size={16} aria-hidden="true" />
                  {copy.auth.admin}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95"
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
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95"
              aria-label={copy.auth.login}
              title={copy.auth.login}
            >
              <LogIn size={16} aria-hidden="true" />
              <span className="whitespace-nowrap">{copy.auth.login}</span>
            </Link>
          )}
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200" aria-label="Language">
            <Languages size={15} className="ml-2 text-slate-500" aria-hidden="true" />
            {locales.map((locale) => (
              <Link
                key={locale}
                href={`${withLocale(basePath, locale)}${querySuffix}`}
                hrefLang={localeMeta[locale].languageTag}
                className={[
                  "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-xs font-black transition",
                  currentLocale === locale
                    ? "bg-teal-700 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")}
                aria-label={`${locale.toUpperCase()} - ${localeMeta[locale].label}`}
              >
                {locale.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <nav className="mx-auto mt-2 hidden max-w-6xl flex-wrap gap-2 md:flex" aria-label={copy.siteName}>
        {[
          { href: "/", label: copy.nav.home },
          { href: "/places", label: copy.places.heading },
          { href: "/guides", label: guideCopy[currentLocale].title },
          { href: "/nearby", label: copy.nav.nearby },
          { href: "/itinerary", label: copy.nav.itinerary },
          { href: "/saved", label: copy.nav.saved },
          { href: "/mypage", label: copy.nav.mypage },
        ].map((item) => <Link key={item.href} href={withLocale(item.href, currentLocale)} aria-current={basePath === item.href ? "page" : undefined} className="inline-flex min-h-11 items-center px-3 text-sm font-bold text-slate-700 hover:bg-teal-50 aria-[current=page]:bg-teal-50 aria-[current=page]:text-teal-800">{item.label}</Link>)}
      </nav>
    </header>
  );
}
