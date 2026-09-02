"use client";

import { Copy, LogIn } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { type Locale, withLocale } from "@/lib/i18n";
import { copySharedTrip } from "@/lib/trip-store";

export function CopySharedTripButton({ shareSlug, title, locale }: { shareSlug: string; title: string; locale: Locale }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const text = copy[locale];

  async function handleCopy() {
    if (loading || pending) return;
    if (!user) {
      router.push(`${withLocale("/login", locale)}?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setPending(true);
    setStatus("");
    const result = await copySharedTrip(shareSlug, `${title}${text.copySuffix}`);
    setPending(false);
    if (!result.tripId) {
      setStatus(result.error ?? text.failed);
      return;
    }
    router.push(`${withLocale("/itinerary", locale)}?trip=${encodeURIComponent(result.tripId)}`);
  }

  return (
    <div>
      <button type="button" onClick={() => void handleCopy()} disabled={pending || loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-black text-white transition active:scale-95 disabled:opacity-50">
        {user ? <Copy size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
        {user ? text.copy : text.loginCopy}
      </button>
      {status ? <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{status}</p> : null}
    </div>
  );
}

const copy = {
  ko: { copy: "내 일정으로 복사", loginCopy: "로그인하고 일정 복사", copySuffix: " 복사본", failed: "일정을 복사하지 못했습니다." },
  zh: { copy: "复制到我的计划", loginCopy: "登录并复制计划", copySuffix: " 副本", failed: "无法复制旅行计划。" },
  en: { copy: "Copy to my trips", loginCopy: "Sign in and copy", copySuffix: " copy", failed: "The trip could not be copied." },
  ja: { copy: "自分のプランにコピー", loginCopy: "ログインしてコピー", copySuffix: " コピー", failed: "プランをコピーできませんでした。" },
} satisfies Record<Locale, Record<string, string>>;
