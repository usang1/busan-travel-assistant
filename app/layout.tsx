import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AuthProvider } from "@/components/AuthProvider";
import { AnalyticsAttribution } from "@/components/AnalyticsAttribution";
import { BottomNavigation } from "@/components/BottomNavigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProEntitlementProvider } from "@/components/ProEntitlementProvider";
import { absoluteUrl, siteConfig } from "@/config/site";
import { defaultLocale, getLocaleFromPath, localeAlternates, localeMeta } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: `${siteConfig.name} | ${siteConfig.englishName}`,
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: absoluteUrl("/"),
    languages: localeAlternates("/"),
  },
  openGraph: {
    title: `${siteConfig.name}｜釜山广安里 Beta 自由行工具`,
    description: siteConfig.description,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentHeaders = await headers();
  const currentPathname = currentHeaders.get("x-current-pathname") ?? "";
  const locale = getLocaleFromPath(currentPathname) ?? defaultLocale;

  return (
    <html lang={localeMeta[locale].languageTag}>
      <body>
        <AuthProvider>
          <ProEntitlementProvider>
            <Suspense fallback={null}>
              <AnalyticsAttribution />
              <Header />
            </Suspense>
            {children}
            <Footer />
            <BottomNavigation />
          </ProEntitlementProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
