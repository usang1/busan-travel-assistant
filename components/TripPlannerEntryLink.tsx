import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { type Locale, withLocale } from "@/lib/i18n";

export function TripPlannerEntryLink({ locale, context }: { locale: Locale; context: "home" | "mypage" }) {
  const text = copy[locale];
  const title = context === "home" ? text.createTitle : text.manageTitle;

  return (
    <Link
      href={withLocale("/itinerary", locale)}
      className="group flex min-h-24 w-full items-center gap-4 rounded-[22px] bg-teal-700 px-4 py-4 text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.99]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
        <CalendarDays size={23} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-teal-50">{text.description}</span>
      </span>
      <ArrowRight size={20} className="shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

const copy = {
  ko: { createTitle: "여행 일정 만들기", manageTitle: "내 여행 일정", description: "저장한 장소를 날짜별로 자동 배치하고 순서를 조정하세요." },
  zh: { createTitle: "创建旅行计划", manageTitle: "我的旅行计划", description: "将收藏地点按日期自动安排，并调整游览顺序。" },
  en: { createTitle: "Create a trip", manageTitle: "My trips", description: "Arrange saved places by day and adjust the visit order." },
  ja: { createTitle: "旅行プランを作成", manageTitle: "旅行プラン", description: "保存した場所を日ごとに自動配置し、訪問順を調整できます。" },
} satisfies Record<Locale, Record<string, string>>;
