import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MySubmissionsView } from "@/components/MySubmissionsView";
import { SectionTitle } from "@/components/SectionTitle";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type LocalizedSubmissionsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

async function getLocale(params: LocalizedSubmissionsPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedSubmissionsPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.submissions.myTitle,
    description: copy.submissions.loginDescription,
    path: "/submissions",
    noIndex: true,
  });
}

export default async function LocalizedSubmissionsPage({ params }: LocalizedSubmissionsPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <SectionTitle title={copy.submissions.myTitle} subtitle={copy.submissions.loginDescription} />
      <div className="mt-5">
        <MySubmissionsView locale={locale} />
      </div>
    </main>
  );
}
