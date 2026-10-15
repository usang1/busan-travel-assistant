import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountOnboarding } from "@/components/AccountOnboarding";
import { SectionTitle } from "@/components/SectionTitle";
import { accountCopy } from "@/lib/account-copy";
import { buildLocalizedMetadata, isLocale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildLocalizedMetadata({ locale, title: accountCopy[locale].title, description: accountCopy[locale].description, path: "/onboarding", noIndex: true });
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = accountCopy[locale];
  return <main className="safe-bottom mx-auto max-w-xl px-4 py-8"><SectionTitle as="h1" title={copy.title} subtitle={copy.description} /><div className="mt-5"><AccountOnboarding locale={locale} /></div></main>;
}
