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

  async function share() {
    const shareUrl = url ?? window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        setStatus("已分享");
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setStatus("链接已复制");
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setStatus("链接已复制");
      } catch {
        setStatus("复制失败");
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
        分享
      </button>
      {status ? <span className="text-xs font-semibold text-teal-700">{status}</span> : null}
    </div>
  );
}
