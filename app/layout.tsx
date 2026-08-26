import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { BottomNavigation } from "@/components/BottomNavigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProEntitlementProvider } from "@/components/ProEntitlementProvider";
import { absoluteUrl, siteConfig } from "@/config/site";
import { localeAlternates } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "釜山旅行助手｜Busan Travel Assistant",
    template: "%s｜釜山旅行助手",
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: absoluteUrl("/"),
    languages: localeAlternates("/"),
  },
  openGraph: {
    title: "釜山旅行助手｜广安里自由行工具",
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
  maximumScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ProEntitlementProvider>
          <Suspense fallback={null}>
            <Header />
          </Suspense>
          {children}
          <Footer />
          <BottomNavigation />
        </ProEntitlementProvider>
      </body>
    </html>
  );
}
