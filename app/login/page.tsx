import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { absoluteUrl, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: `登录｜${siteConfig.englishName}`,
  description: "Log in to save places across Busan, Seoul, and Jeju and send place updates.",
  alternates: { canonical: absoluteUrl("/login") },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
