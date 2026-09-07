import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LoginPage from "@/app/login/page";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type LocalizedLoginPageProps = {
  params: Promise<{ locale: string }>;
};

async function getLocale(params: LocalizedLoginPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedLoginPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.auth.login,
    description: copy.submissions.loginDescription,
    path: "/login",
    noIndex: true,
  });
}

export default LoginPage;
