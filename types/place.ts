import type { LucideIcon } from "lucide-react";

export type LocalizedText = {
  zh: string;
  en: string;
  ja: string;
  ko: string;
};

export type QuickAction = {
  title: LocalizedText;
  href: string;
  accent: string;
  icon: LucideIcon;
};
