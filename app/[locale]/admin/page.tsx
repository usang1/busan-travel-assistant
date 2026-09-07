import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminPage from "@/app/admin/page";
import { buildLocalizedMetadata, isLocale, type Locale, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type LocalizedAdminPageProps = {
  params: Promise<{ locale: string }>;
};

async function getLocale(params: LocalizedAdminPageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({ params }: LocalizedAdminPageProps): Promise<Metadata> {
  const locale = await getLocale(params);
  const copy = ui[locale];

  return buildLocalizedMetadata({
    locale,
    title: copy.nav.admin,
    description: copy.auth.admin,
    path: "/admin",
    noIndex: true,
    follow: false,
  });
}

export default AdminPage;
