"use client";

import Link from "next/link";
import { Bookmark, CalendarDays, Home, MapPinned } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首页", ko: "홈", href: "/", icon: Home },
  { label: "附近", ko: "주변", href: "/nearby", icon: MapPinned },
  { label: "行程", ko: "일정", href: "/itinerary", icon: CalendarDays },
  { label: "收藏", ko: "저장", href: "/saved", icon: Bookmark },
];

export function BottomNavigation() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href.split("?")[0]));

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-2xl text-xs font-medium transition active:scale-95",
                active ? "bg-teal-50 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="mt-1 leading-none">{item.label}</span>
              <span className="sr-only">{item.ko}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
