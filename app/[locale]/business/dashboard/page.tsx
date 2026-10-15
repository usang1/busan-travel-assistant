import type { Metadata } from "next";
import { accountCopy } from "@/lib/account-copy";
import { SectionTitle } from "@/components/SectionTitle";
import { notFound } from "next/navigation";
import { BusinessDashboard } from "@/components/BusinessDashboard";
import { buildLocalizedMetadata, isLocale } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <main className="safe-bottom mx-auto max-w-7xl px-4 pb-8 pt-5"><SectionTitle as="h1" title={accountCopy[locale].businessTitle} subtitle={accountCopy[locale].businessDescription} /><div className="mt-5"><BusinessDashboard locale={locale} /></div></main>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = accountCopy[locale];
  return buildLocalizedMetadata({ locale, title: copy.businessTitle, description: copy.businessDescription, path: "/business/dashboard", noIndex: true });
}
