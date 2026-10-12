import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { landingCopy } from "@/components/landing/landing-copy";
import {
  buildLocalizedMetadata,
  isLocale,
  type Locale,
} from "@/lib/i18n";

type LocalePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const revalidate = 300;

async function getLocale(params: LocalePageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = landingCopy[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.metaTitle,
    description: copy.metaDescription,
    path: "/",
  });
}

export default async function LocalizedHome({ params }: LocalePageProps) {
  const locale = await getLocale(params);
  return <LandingPage locale={locale} />;
}
