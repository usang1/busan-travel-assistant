import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyPageView } from "@/components/MyPageView";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

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

  return buildLocalizedMetadata({
    locale,
    title: copy.mypage.title,
    description: copy.mypage.subtitle,
    path: "/mypage",
    noIndex: true,
  });
}

export default async function LocalizedMyPage({ params }: LocalizedMyPageProps) {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return (
    <main className="safe-bottom mx-auto max-w-5xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <h1 className="editorial-heading">{copy.mypage.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6f746e]">{copy.mypage.subtitle}</p>
      <div className="mt-7">
        <MyPageView locale={locale} />
      </div>
    </main>
  );
}
