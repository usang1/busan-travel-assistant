import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceSubmissionForm } from "@/components/PlaceSubmissionForm";
import { siteConfig } from "@/config/site";
import { isLocale, localeAlternates, localizedCanonical, type Locale, ui } from "@/lib/i18n";

type LocalizedContactPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

async function getLocale(params: LocalizedContactPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedContactPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return {
    title: copy.submissions.title,
    description: copy.submissions.description,
    alternates: {
      canonical: localizedCanonical("/contact", locale),
      languages: localeAlternates("/contact"),
    },
    robots: { index: false, follow: true },
  };
}

export default async function LocalizedContactPage({ params }: LocalizedContactPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <div className="mb-6">
        <PlaceSubmissionForm locale={locale} />
      </div>
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <h1 className="text-3xl font-black tracking-normal">{copy.footerLinks.contact}</h1>
        <p className="mt-2 text-sm text-slate-300">{copy.submissions.description}</p>
      </section>
      <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-black text-slate-950">Email</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{siteConfig.contactEmail}</p>
      </section>
    </main>
  );
}
