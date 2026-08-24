import {
  Camera,
  CalendarDays,
  Luggage,
  MapPinned,
  MessageSquareText,
  Utensils,
} from "lucide-react";
import type { QuickAction } from "@/types/place";

export const quickActions: QuickAction[] = [
  {
    title: { zh: "吃什么？", ko: "뭐 먹지?" },
    href: "/places?category=restaurant",
    accent: "from-rose-500 to-orange-400",
    icon: Utensils,
  },
  {
    title: { zh: "拍照地图", ko: "사진스팟" },
    href: "/photo-spots",
    accent: "from-sky-500 to-cyan-400",
    icon: Camera,
  },
  {
    title: { zh: "今日行程", ko: "오늘 일정" },
    href: "/itinerary",
    accent: "from-emerald-500 to-teal-400",
    icon: CalendarDays,
  },
  {
    title: { zh: "给韩国人看", ko: "한국인에게 보여주기" },
    href: "/translator",
    accent: "from-violet-500 to-fuchsia-400",
    icon: MessageSquareText,
  },
  {
    title: { zh: "行李寄存", ko: "짐 보관" },
    href: "/luggage",
    accent: "from-amber-500 to-yellow-400",
    icon: Luggage,
  },
  {
    title: { zh: "附近推荐", ko: "주변 추천" },
    href: "/nearby",
    accent: "from-slate-700 to-teal-600",
    icon: MapPinned,
  },
];
