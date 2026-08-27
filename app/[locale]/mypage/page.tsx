import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyPageView } from "@/components/MyPageView";
import { isLocale, localeAlternates, localizedCanonical, type Locale, ui } from "@/lib/i18n";

type LocalizedMyPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const dynamic = "force-dynamic";

async function getLocale(params: LocalizedMyPageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({ params }: LocalizedMyPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return {
    title: copy.mypage.title,
    description: copy.mypage.subtitle,
    alternates: {
      canonical: localizedCanonical("/mypage", locale),
      languages: localeAlternates("/mypage"),
    },
    robots: { index: false, follow: true },
  };
}

export default async function LocalizedMyPage({ params }: LocalizedMyPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="text-2xl font-black text-slate-950">{copy.mypage.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{copy.mypage.subtitle}</p>
      <div className="mt-5">
        <MyPageView locale={locale} />
      </div>
    </main>
  );
}
