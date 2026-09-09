import type { Metadata } from "next";
import { SavedItemsView } from "@/components/SavedItemsView";
import { SavedGuides } from "@/components/SavedGuides";
import { SectionTitle } from "@/components/SectionTitle";
import { absoluteUrl } from "@/config/site";
import { defaultLocale, ui } from "@/lib/i18n";

export const metadata: Metadata = {
  title: ui[defaultLocale].mypage.savedPlaces,
  description: ui[defaultLocale].mypage.savedEmptyDescription,
  alternates: { canonical: absoluteUrl("/saved") },
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={ui[defaultLocale].mypage.savedPlaces} subtitle={ui[defaultLocale].mypage.subtitle} />
      <div className="mt-5">
        <SavedItemsView locale={defaultLocale} />
        <SavedGuides locale={defaultLocale} />
      </div>
    </main>
  );
}
