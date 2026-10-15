import type { Metadata } from "next";
import { accountCopy } from "@/lib/account-copy";
import { notFound } from "next/navigation";
import { BusinessApplicationForm } from "@/components/BusinessApplicationForm";
import { SectionTitle } from "@/components/SectionTitle";
import { SubmissionTypeNavigation } from "@/components/SubmissionTypeNavigation";
import { buildLocalizedMetadata, isLocale } from "@/lib/i18n";
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = accountCopy[locale];
  return <main className="safe-bottom mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6 lg:pt-12"><SectionTitle as="h1" title={copy.applicationTitle} subtitle={copy.applicationDescription} /><div className="mt-6"><SubmissionTypeNavigation active="business" locale={locale} /></div><div className="mt-4"><BusinessApplicationForm locale={locale} /></div></main>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = accountCopy[locale];
  return buildLocalizedMetadata({ locale, title: copy.applicationTitle, description: copy.applicationDescription, path: "/business-application" });
}
