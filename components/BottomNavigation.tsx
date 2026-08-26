"use client";

import Link from "next/link";
import { Bookmark, CalendarDays, Home, MapPinned } from "lucide-react";
import { usePathname } from "next/navigation";
import { defaultLocale, getLocaleFromPath, ui, withLocale, withoutLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "home", href: "/", icon: Home },
  { key: "nearby", href: "/nearby", icon: MapPinned },
  { key: "itinerary", href: "/itinerary", icon: CalendarDays },
  { key: "saved", href: "/saved", icon: Bookmark },
] as const;

const secondaryLabels = {
  zh: { home: "홈", nearby: "주변", itinerary: "일정", saved: "저장" },
  en: { home: "Home", nearby: "Nearby", itinerary: "Routes", saved: "Saved" },
  ja: { home: "ホーム", nearby: "近く", itinerary: "旅程", saved: "保存" },
  ko: { home: "Home", nearby: "Nearby", itinerary: "Routes", saved: "Saved" },
};

export function BottomNavigation() {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const currentPath = withoutLocale(pathname);
  const copy = ui[locale];

  if (currentPath.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));

          return (
            <Link
              key={item.key}
              href={withLocale(item.href, locale)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-medium transition active:scale-95",
                active ? "bg-teal-50 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="mt-1 leading-none">{copy.nav[item.key]}</span>
              <span className="sr-only">{secondaryLabels[locale][item.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
