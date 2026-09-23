import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceSubmissionForm } from "@/components/PlaceSubmissionForm";
import { siteConfig } from "@/config/site";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type LocalizedContactPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    name?: string | string[];
    location?: string | string[];
    reason?: string | string[];
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

  return buildLocalizedMetadata({
    locale,
    title: copy.footerLinks.contact,
    description: copy.submissions.description,
    path: "/contact",
  });
}

export default async function LocalizedContactPage({ params, searchParams }: LocalizedContactPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];
  const query = await searchParams;
  const initialValues = {
    name: safeQueryValue(query.name, 120),
    location: safeQueryValue(query.location, 240),
    reason: safeQueryValue(query.reason, 1000),
  };

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <h1 className="text-3xl font-black tracking-normal">{copy.footerLinks.contact}</h1>
        <p className="mt-2 text-sm text-slate-300">{copy.submissions.description}</p>
      </section>
      <div className="mt-6">
        <PlaceSubmissionForm locale={locale} initialValues={initialValues} />
      </div>
      {siteConfig.contactEmail ? (
        <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-black text-slate-950">{copy.mypage.email}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{siteConfig.contactEmail}</p>
        </section>
      ) : null}
    </main>
  );
}

function safeQueryValue(value: string | string[] | undefined, maxLength: number) {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected?.normalize("NFKC").split("").map((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? " " : character;
  }).join("").trim().slice(0, maxLength) ?? "";
}
