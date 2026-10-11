import Link from "next/link";
import { MapPinPlus, Store } from "lucide-react";
import { type Locale, ui, withLocale } from "@/lib/i18n";

type SubmissionTypeNavigationProps = {
  active: "place" | "business";
  locale: Locale;
};

const heading: Record<Locale, string> = {
  zh: "请选择申请类型",
  en: "Choose a submission type",
  ja: "申請タイプを選択",
  ko: "신청 유형을 선택해 주세요",
};

export function SubmissionTypeNavigation({ active, locale }: SubmissionTypeNavigationProps) {
  const copy = ui[locale];
  const items = [
    { key: "place" as const, href: "/contact", label: copy.nav.submit, icon: MapPinPlus },
    { key: "business" as const, href: "/business-application", label: copy.nav.businessApplication, icon: Store },
  ];

  return (
    <nav aria-label={heading[locale]} className="rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <p className="px-2 pb-3 text-sm font-black text-slate-700">{heading[locale]}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <Link
              key={item.key}
              href={withLocale(item.href, locale)}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-center text-sm font-black transition active:scale-[0.98]",
                isActive
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-800",
              ].join(" ")}
            >
              <Icon size={18} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
