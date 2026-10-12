import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { landingCopy } from "@/components/landing/landing-copy";
import { buildLocalizedMetadata } from "@/lib/i18n";

export const revalidate = 300;

const locale = "zh";
const copy = landingCopy[locale];

export const metadata: Metadata = buildLocalizedMetadata({
  locale,
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: "/",
});

export default async function Home() {
  return <LandingPage locale={locale} />;
}
