import { Soup } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getTasteProfile, hasTasteData } from "@/lib/traveler-practical-display";
import type { PlaceWithRelations } from "@/types/database";

export function TasteProfileCard({ place, locale, variant = "compact" }: { place: PlaceWithRelations; locale: Locale; variant?: "compact" | "detail" }) {
  if (place.category !== "restaurant" && place.category !== "bar" && !hasTasteData(place)) return null;
  const items = getTasteProfile(place, locale);

  if (variant === "compact") {
    return (
      <section className="mt-3 border-t border-slate-100 pt-3" aria-label={copy[locale].title}>
        <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs">
          {items.map((item) => <p key={item.key} className="min-w-0"><span className="font-bold text-slate-500">{item.label}</span><span className="ml-1 break-words font-black text-slate-900">{item.value}</span></p>)}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200" aria-label={copy[locale].title}>
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Soup size={20} aria-hidden="true" />{copy[locale].title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => <div key={item.key} className="rounded-md bg-slate-50 px-3 py-3 ring-1 ring-slate-100"><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-1 break-words text-sm font-black text-slate-950">{item.value}</p></div>)}
      </div>
    </section>
  );
}

const copy: Record<Locale, { title: string }> = {
  ko: { title: "입맛·주문 판단" }, zh: { title: "中国人口味与点餐" },
  en: { title: "Taste and ordering check" }, ja: { title: "味・注文の判断" },
};
