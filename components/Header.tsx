import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="釜山旅行助手 首页">
          <span className="grid size-9 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">釜山旅行助手</span>
            <span className="block text-[11px] text-slate-500">Busan Travel Assistant</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
          <MapPin size={15} className="text-teal-700" aria-hidden="true" />
          广安里
        </div>
      </div>
    </header>
  );
}
