import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { defaultLocale, type Locale, ui } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: ui[defaultLocale].admin.title,
  description: ui[defaultLocale].admin.description,
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage({ locale = defaultLocale }: { locale?: Locale }) {
  const copy = ui[locale].admin;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-6">
      <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10">
          <ShieldCheck size={16} aria-hidden="true" />
          {copy.eyebrow}
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          {copy.description}
        </p>
      </section>

      <section className="mt-8">
        <AdminShell locale={locale} />
      </section>
    </main>
  );
}
