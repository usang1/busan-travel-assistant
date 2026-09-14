import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { EmptyState } from "@/components/EmptyState";
import { defaultLocale, getLocaleFromPath, localizedTitle, type Locale, ui, withLocale } from "@/lib/i18n";

async function getNotFoundLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  return getLocaleFromPath(requestHeaders.get("x-current-pathname") ?? "") ?? defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getNotFoundLocale();
  const copy = ui[locale].notFound;

  return {
    title: localizedTitle(copy.title, locale),
    description: copy.description,
  };
}

export default async function NotFound() {
  const locale = await getNotFoundLocale();
  const copy = ui[locale].notFound;

  return (
    <>
      <meta name="robots" content="nofollow" />
      <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-8">
        <EmptyState title={copy.title} description={copy.description} />
        <Link
          href={withLocale("/", locale)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white shadow-sm"
        >
          {copy.home}
        </Link>
      </main>
    </>
  );
}
