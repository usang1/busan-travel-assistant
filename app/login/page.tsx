import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { absoluteUrl, siteConfig } from "@/config/site";
import { defaultLocale, ui } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${ui[defaultLocale].authFlow.signinTitle}｜${siteConfig.englishName}`,
  description: ui[defaultLocale].authFlow.signinDescription,
  alternates: { canonical: absoluteUrl("/login") },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <main className="safe-bottom mx-auto max-w-2xl px-4 pb-10 pt-10 sm:px-6 lg:pt-16">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
