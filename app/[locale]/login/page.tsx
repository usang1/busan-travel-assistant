import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LoginPage from "@/app/login/page";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

type LocalizedLoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
};

async function getLocale(params: LocalizedLoginPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params, searchParams }: LocalizedLoginPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale].authFlow;
  const mode = (await searchParams).mode;
  const isSignup = Array.isArray(mode) ? mode.includes("signup") : mode === "signup";

  return buildLocalizedMetadata({
    locale,
    title: isSignup ? copy.signupTitle : copy.signinTitle,
    description: isSignup ? copy.signupDescription : copy.signinDescription,
    path: "/login",
    noIndex: true,
  });
}

export default LoginPage;
