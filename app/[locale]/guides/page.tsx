import { notFound } from "next/navigation";
import { GuideExplorer } from "@/components/GuideExplorer";
import { guideCopy } from "@/lib/guide-copy";
import { getPublishedGuides } from "@/lib/guide-store";
import { isLocale, buildLocalizedMetadata } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return buildLocalizedMetadata({ locale, path: "/guides", title: guideCopy[locale].title, description: guideCopy[locale].description });
}
export default async function GuidesPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { guides, unavailable } = await getPublishedGuides();
  const copy = guideCopy[locale];
  return <main className="safe-bottom mx-auto max-w-3xl space-y-6 px-4 pb-6 pt-5">
    <div><h1 className="text-2xl font-black text-slate-950">{copy.title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{copy.description}</p></div>
    {unavailable ? <p role="status" className="rounded-2xl bg-white p-5 text-sm text-slate-600">{copy.unavailable}</p> : <GuideExplorer guides={guides} locale={locale} />}
  </main>;
}
