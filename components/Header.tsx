"use client";

import Image from "next/image";
import Link from "next/link";
import { Languages, LogIn, LogOut, MapPin, Send, ShieldCheck, Store, UserRound } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { defaultLocale, getLocaleFromPath, localeMeta, locales, ui, withLocale, withoutLocale } from "@/lib/i18n";
import { getSupabaseClient } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentLocale = getLocaleFromPath(pathname) ?? defaultLocale;
  const copy = ui[currentLocale];
  const brandLogo = currentLocale === "zh" ? "/brand/spotzari-zh.png" : "/brand/spotzari-ko.png";
  const businessDashboardLabel = { ko: "내 가게 관리", zh: "我的店铺", en: "My business", ja: "店舗管理" }[currentLocale];
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

  if (basePath === "/") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-[#e8e4dd]/90 bg-[#f8f7f4]/94 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Link href={withLocale("/", currentLocale)} className="flex min-h-12 min-w-[160px] flex-1 items-center gap-2.5" aria-label={`${copy.siteName} ${copy.nav.home}`}>
          <span className="relative size-11 shrink-0 overflow-hidden bg-white ring-1 ring-[#e8e4dd]">
            <Image src={brandLogo} alt="" width={48} height={48} className="size-12 object-cover" preload aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black tracking-[-0.03em] text-[#252824]">{copy.siteName}</span>
            <span className="block text-[11px] font-semibold tracking-wide text-[#6f746e]">Korea local food &amp; travel</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <div className="hidden items-center gap-1.5 border border-[#e8e4dd] bg-white px-3 py-2 text-sm font-medium text-[#555b55] sm:flex">
            <MapPin size={15} className="text-[#4f6652]" aria-hidden="true" />
            {copy.region}
          </div>
          <Link
            href={withLocale("/contact", currentLocale)}
            className="inline-flex size-11 shrink-0 items-center justify-center bg-white text-[#555b55] ring-1 ring-[#e8e4dd] transition hover:bg-[#f1eee8] active:scale-95"
            aria-label={copy.nav.submit}
            title={copy.nav.submit}
          >
            <Send size={17} aria-hidden="true" />
          </Link>
          <Link
            href={withLocale("/business-application", currentLocale)}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 bg-[#edf2eb] px-3 text-sm font-black text-[#4f6652] ring-1 ring-[#d8e0d5] transition hover:bg-[#dfe8dc] active:scale-95"
            aria-label={copy.nav.businessApplication}
            title={copy.nav.businessApplication}
          >
            <Store size={17} aria-hidden="true" />
            <span className="whitespace-nowrap">{copy.nav.businessApplication}</span>
          </Link>
          {user ? (
            <>
              <Link href={withLocale("/business/dashboard", currentLocale)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-indigo-50 px-3 text-sm font-black text-indigo-800 ring-1 ring-indigo-100"><Store size={16} aria-hidden="true" /><span className="hidden sm:inline">{businessDashboardLabel}</span></Link>
              <Link
                href={withLocale("/mypage", currentLocale)}
                className="inline-flex size-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 active:scale-95 sm:w-auto sm:gap-1.5 sm:px-3"
                aria-label={copy.auth.mypage}
                title={copy.auth.mypage}
              >
                <UserRound size={16} aria-hidden="true" />
                <span className="hidden text-sm font-black sm:inline">{copy.auth.mypage}</span>
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
          <div className="flex items-center gap-1 bg-white p-1 ring-1 ring-[#e8e4dd]" aria-label="Language">
            <Languages size={15} className="ml-2 text-slate-500" aria-hidden="true" />
            {locales.map((locale) => (
              <Link
                key={locale}
                href={`${withLocale(basePath, locale)}${querySuffix}`}
                hrefLang={localeMeta[locale].languageTag}
                className={[
                  "inline-flex h-11 min-w-11 items-center justify-center px-2 text-xs font-black transition",
                  currentLocale === locale
                    ? "bg-[#4f6652] text-white"
                    : "text-[#6f746e] hover:bg-[#f1eee8] hover:text-[#252824]",
                ].join(" ")}
                aria-label={`${locale.toUpperCase()} - ${localeMeta[locale].label}`}
              >
                {locale.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <nav className="mx-auto mt-1 hidden max-w-7xl flex-wrap gap-1 md:flex" aria-label={copy.siteName}>
        {[
          { href: "/", label: copy.nav.home },
          { href: "/places", label: copy.nav.places },
          { href: "/nearby", label: copy.nav.nearby },
          { href: "/itinerary", label: copy.nav.itinerary },
          { href: "/saved", label: copy.nav.saved },
          { href: "/business-application", label: copy.nav.businessApplication },
          ...(user ? [{ href: "/business/dashboard", label: businessDashboardLabel }] : []),
        ].map((item) => <Link key={item.href} href={withLocale(item.href, currentLocale)} aria-current={basePath === item.href ? "page" : undefined} className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-bold text-[#555b55] transition hover:text-[#252824] aria-[current=page]:border-[#768a75] aria-[current=page]:text-[#4f6652]">{item.label}</Link>)}
      </nav>
    </header>
  );
}
