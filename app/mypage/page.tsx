import type { Metadata } from "next";
import { MyPageView } from "@/components/MyPageView";
import { absoluteUrl } from "@/config/site";
import { defaultLocale, ui } from "@/lib/i18n";

export const metadata: Metadata = {
  title: ui[defaultLocale].mypage.title,
  description: ui[defaultLocale].mypage.subtitle,
  alternates: { canonical: absoluteUrl("/mypage") },
  robots: { index: false, follow: true },
};

export default function MyPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <h1 className="text-2xl font-black text-slate-950">{ui[defaultLocale].mypage.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{ui[defaultLocale].mypage.subtitle}</p>
      <div className="mt-5">
        <MyPageView locale={defaultLocale} />
      </div>
    </main>
  );
}
