import type { LucideIcon } from "lucide-react";

export type LocalizedText = {
  zh: string;
  ko: string;
};

export type QuickAction = {
  title: LocalizedText;
  href: string;
  accent: string;
  icon: LucideIcon;
};
