import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallbackHandler } from "@/components/AuthCallbackHandler";

export const metadata: Metadata = {
  title: "Auth Callback",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <Suspense fallback={null}>
        <AuthCallbackHandler />
      </Suspense>
    </main>
  );
}
