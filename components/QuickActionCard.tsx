import Link from "next/link";
import { defaultLocale, type Locale, withLocale } from "@/lib/i18n";
import type { QuickAction } from "@/types/place";

type QuickActionCardProps = {
  action: QuickAction;
  locale?: Locale;
};

export function QuickActionCard({ action, locale = defaultLocale }: QuickActionCardProps) {
  const Icon = action.icon;

  return (
    <Link
      href={withLocale(action.href, locale)}
      className="group min-h-28 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
    >
      <span
        className={`mb-4 grid size-11 place-items-center rounded-2xl bg-gradient-to-br ${action.accent} text-white shadow-sm`}
      >
        <Icon size={21} aria-hidden="true" />
      </span>
      <span className="block text-lg font-bold text-slate-950">{action.title[locale]}</span>
      <span className="mt-1 block text-xs text-slate-500">{locale === "ko" ? action.title.en : action.title.ko}</span>
    </Link>
  );
}
