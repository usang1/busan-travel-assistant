import { notFound } from "next/navigation";
import { BusinessDashboard } from "@/components/BusinessDashboard";
import { isLocale } from "@/lib/i18n";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <main className="safe-bottom mx-auto max-w-7xl px-4 pb-8 pt-5"><BusinessDashboard locale={locale} /></main>;
}
