"use client";

import Link from "next/link";
import { Bookmark, CalendarDays, Compass, Home, MapPinned, Store } from "lucide-react";
import { usePathname } from "next/navigation";
import { defaultLocale, getLocaleFromPath, ui, withLocale, withoutLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "home", href: "/", icon: Home },
  { key: "places", href: "/places", icon: Compass },
  { key: "nearby", href: "/nearby", icon: MapPinned },
  { key: "itinerary", href: "/itinerary", icon: CalendarDays },
  { key: "saved", href: "/saved", icon: Bookmark },
  { key: "businessApplicationShort", href: "/business-application", icon: Store },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const currentPath = withoutLocale(pathname);
  const copy = ui[locale];

  if (currentPath === "/" || currentPath.startsWith("/admin")) {
    return null;
  }

  return (
    <nav aria-label={copy.siteName} className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e4dd] bg-[#fff]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-10px_30px_rgba(37,40,36,0.06)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));

          return (
            <Link
              key={item.key}
              href={withLocale(item.href, locale)}
              aria-current={active ? "page" : undefined}
              aria-label={copy.nav[item.key]}
              className={cn(
                "flex h-14 min-w-0 flex-col items-center justify-center px-1 text-xs font-medium transition active:scale-95",
                active ? "bg-[#edf2eb] text-[#4f6652]" : "text-[#777d77] hover:bg-[#f8f7f4] hover:text-[#252824]",
              )}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="mt-1 max-w-full truncate text-center leading-tight">{copy.nav[item.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
