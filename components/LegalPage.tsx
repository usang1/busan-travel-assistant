import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/config/site";

export function legalMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(path),
    },
    openGraph: {
      title: `${title}｜${siteConfig.name}`,
      description,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "article",
    },
  };
}

export function LegalPage({
  titleZh,
  titleKo,
  description,
  sections,
}: {
  titleZh: string;
  titleKo: string;
  description: string;
  sections: Array<{ title: string; body: string }>;
}) {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <h1 className="text-3xl font-black tracking-normal">{titleZh}</h1>
        {titleKo ? <p className="mt-2 text-sm text-slate-300">{titleKo}</p> : null}
        <p className="mt-4 text-sm leading-6 text-slate-300">{description}</p>
      </section>
      <div className="mt-5 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-black text-slate-950">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
