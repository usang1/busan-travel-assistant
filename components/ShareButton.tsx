"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { recordPlaceEvent } from "@/lib/place-events";
import { defaultLocale, getLocaleFromPath, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ShareButtonProps = {
  title: string;
  text: string;
  url?: string;
  className?: string;
  placeId?: string;
  locale?: Locale;
};

export function ShareButton({ title, text, url, className, placeId, locale }: ShareButtonProps) {
  const [status, setStatus] = useState("");
  const pathname = usePathname();
  const currentLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const { user } = useAuth();
  const copy = shareCopy[currentLocale];

  async function share() {
    const shareUrl = url ?? window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        setStatus(copy.shared);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setStatus(copy.copied);
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setStatus(copy.copied);
      } catch {
        setStatus(copy.failed);
      }
    }

    if (placeId) {
      void recordPlaceEvent({
        eventType: "share",
        placeId,
        locale: currentLocale,
        userId: user?.id,
      });
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void share()}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-95",
          className,
        )}
      >
        <Share2 size={17} aria-hidden="true" />
        {copy.share}
      </button>
      {status ? <span className="text-xs font-semibold text-teal-700">{status}</span> : null}
    </div>
  );
}

const shareCopy: Record<Locale, { share: string; shared: string; copied: string; failed: string }> = {
  zh: { share: "分享", shared: "已分享", copied: "链接已复制", failed: "复制失败" },
  en: { share: "Share", shared: "Shared", copied: "Link copied", failed: "Copy failed" },
  ja: { share: "共有", shared: "共有しました", copied: "リンクをコピーしました", failed: "コピーに失敗しました" },
  ko: { share: "공유", shared: "공유했습니다", copied: "링크를 복사했습니다", failed: "복사에 실패했습니다" },
};
