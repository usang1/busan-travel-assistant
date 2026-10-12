import type { Metadata } from "next";
import { ExploreHomePage } from "@/components/ExploreHomePage";
import { buildLocalizedMetadata, ui } from "@/lib/i18n";

const locale = "zh";
export const revalidate = 300;
export const metadata: Metadata = buildLocalizedMetadata({ locale, title: ui[locale].home.title, description: ui[locale].home.description, path: "/explore" });

export default function Page() {
  return <ExploreHomePage locale={locale} />;
}
