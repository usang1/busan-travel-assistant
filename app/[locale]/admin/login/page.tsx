import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type LocaleAdminLoginPageProps = {
  params: Promise<{
    locale: Locale;
  }>;
};

export default async function LocaleAdminLoginPage({ params }: LocaleAdminLoginPageProps) {
  const { locale } = await params;
  redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
}
