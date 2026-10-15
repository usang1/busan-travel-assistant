"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { defaultLocale, getLocaleFromPath, withLocale } from "@/lib/i18n";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = getLocaleFromPath(usePathname()) ?? defaultLocale;
  const copy = {
    ko: { title: "페이지를 불러오지 못했습니다", detail: "일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.", retry: "다시 시도", home: "홈으로" },
    zh: { title: "无法加载页面", detail: "可能出现了暂时性错误，请稍后重试。", retry: "重试", home: "返回首页" },
    en: { title: "Could not load this page", detail: "This may be temporary. Please try again shortly.", retry: "Try again", home: "Go home" },
    ja: { title: "ページを読み込めませんでした", detail: "一時的なエラーの可能性があります。しばらくしてから再度お試しください。", retry: "再試行", home: "ホームへ" },
  }[locale];
  return <main className="safe-bottom mx-auto max-w-3xl space-y-4 px-4 py-8">
    <h1 className="text-2xl font-black">{copy.title}</h1>
    <p role="alert" className="text-slate-600">{copy.detail}</p>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={retry} className="ui-button-primary">{copy.retry}</button><Link href={withLocale("/", locale)} className="ui-button-secondary">{copy.home}</Link></div>
  </main>;
}
