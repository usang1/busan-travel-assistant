import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SavedItemsView } from "@/components/SavedItemsView";
import { SectionTitle } from "@/components/SectionTitle";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type LocalizedSavedPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

async function getLocale(params: LocalizedSavedPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedSavedPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.mypage.savedPlaces,
    description: copy.mypage.savedEmptyDescription,
    path: "/saved",
    noIndex: true,
  });
}

export default async function LocalizedSavedPage({ params }: LocalizedSavedPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={copy.mypage.savedPlaces} subtitle={copy.mypage.subtitle} />
      <div className="mt-5">
        <SavedItemsView locale={locale} />
      </div>
    </main>
  );
}
