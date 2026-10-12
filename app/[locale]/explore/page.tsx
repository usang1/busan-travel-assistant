import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExploreHomePage } from "@/components/ExploreHomePage";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };
export const revalidate = 300;

async function resolveLocale(params: Props["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return buildLocalizedMetadata({ locale, title: ui[locale].home.title, description: ui[locale].home.description, path: "/explore" });
}

export default async function Page({ params }: Props) {
  return <ExploreHomePage locale={await resolveLocale(params)} />;
}
