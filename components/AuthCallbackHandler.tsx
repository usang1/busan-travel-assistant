"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth-flow";
import { defaultLocale, getLocaleFromPath, isLocale, type Locale, ui, withLocale } from "@/lib/i18n";
import { getSupabaseClient } from "@/lib/supabase";

function getCallbackParams(searchParams: ReturnType<typeof useSearchParams>) {
  const params = new URLSearchParams(searchParams.toString());

  if (typeof window !== "undefined" && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return params;
}

function getSafeLocale(value: string | null, nextPath: string): Locale {
  const nextLocale = getLocaleFromPath(nextPath);
  if (nextLocale) return nextLocale;
  return isLocale(value ?? undefined) ? (value as Locale) : defaultLocale;
}

function buildLoginRedirect(locale: Locale, nextPath: string, errorCode: string) {
  const params = new URLSearchParams();
  params.set("next", nextPath);
  params.set("oauth_error", errorCode);
  return `${withLocale("/login", locale)}?${params.toString()}`;
}

export function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);
  const [status, setStatus] = useState("");

  const callbackState = useMemo(() => {
    const params = getCallbackParams(searchParams);
    const fallbackLocale = isLocale(params.get("locale") ?? undefined) ? (params.get("locale") as Locale) : defaultLocale;
    const nextPath = getSafeNextPath(params.get("next"), withLocale("/saved", fallbackLocale));
    const locale = getSafeLocale(params.get("locale"), nextPath);

    return {
      code: params.get("code"),
      error: params.get("error"),
      errorCode: params.get("error_code"),
      locale,
      nextPath,
    };
  }, [searchParams]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const client = getSupabaseClient();
    if (!client) {
      router.replace(buildLoginRedirect(callbackState.locale, callbackState.nextPath, "missing_config"));
      return;
    }

    if (callbackState.error || callbackState.errorCode) {
      router.replace(buildLoginRedirect(callbackState.locale, callbackState.nextPath, callbackState.errorCode ?? callbackState.error ?? "oauth_error"));
      return;
    }

    if (!callbackState.code) {
      router.replace(buildLoginRedirect(callbackState.locale, callbackState.nextPath, "missing_code"));
      return;
    }

    setStatus(ui[callbackState.locale].authFlow.callbackProcessing);
    void client.auth
      .exchangeCodeForSession(callbackState.code)
      .then(({ error }) => {
        if (error) {
          const code = error.code || "oauth_error";
          router.replace(buildLoginRedirect(callbackState.locale, callbackState.nextPath, code));
          return;
        }

        router.replace(callbackState.nextPath);
        router.refresh();
      })
      .catch(() => {
        router.replace(buildLoginRedirect(callbackState.locale, callbackState.nextPath, "oauth_error"));
      });
  }, [callbackState, router]);

  const copy = ui[callbackState.locale].authFlow;

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white">
          <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">{copy.callbackTitle}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">{status || copy.callbackProcessing}</p>
        </div>
      </div>
    </section>
  );
}
