"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogIn, Mail, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { pendingPlaceSaveStorageKey, type PendingPlaceSave, getSafeNextPath } from "@/lib/auth-flow";
import { recordPlaceEvent } from "@/lib/place-events";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, type Locale, ui, withLocale } from "@/lib/i18n";

type AuthMode = "signin" | "signup";
const authAnalyticsEventNames: Record<AuthMode, string> = {
  signin: "auth_signin_submit",
  signup: "auth_signup_submit",
};

type AuthDisplayError = {
  code?: string;
  message?: string;
  status?: number;
};

function getAuthErrorMessage(error: AuthDisplayError, text: (typeof ui)[Locale]["authFlow"], mode: AuthMode) {
  const message = error.message ?? "";
  const normalizedMessage = message.toLowerCase();
  const isEmailRateLimit =
    error.code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    normalizedMessage.includes("email rate limit") ||
    normalizedMessage.includes("rate limit exceeded");

  if (isEmailRateLimit) return text.emailRateLimited;
  if (message.trim()) return message;
  return mode === "signin" ? text.signinErrorFallback : text.signupErrorFallback;
}

function getModeFromSearch(searchParams: ReturnType<typeof useSearchParams>): AuthMode {
  return searchParams.get("mode") === "signup" ? "signup" : "signin";
}

export function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const text = ui[locale].authFlow;
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => getModeFromSearch(searchParams));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextPath = useMemo(
    () => getSafeNextPath(searchParams.get("next"), withLocale("/saved", locale)),
    [locale, searchParams],
  );
  const title = mode === "signin" ? text.signinTitle : text.signupTitle;
  const description = mode === "signin" ? text.signinDescription : text.signupDescription;
  const submitLabel = mode === "signin" ? text.signinSubmit : text.signupSubmit;

  useEffect(() => {
    setMode(getModeFromSearch(searchParams));
  }, [searchParams]);

  function updateMode(nextMode: AuthMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "signup") {
      params.set("mode", "signup");
    } else {
      params.delete("mode");
    }
    const query = params.toString();
    setMode(nextMode);
    setMessage("");
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function recordAuthAnalyticsEvent(eventName: string) {
    window.dispatchEvent(new CustomEvent("auth-flow-event", { detail: { eventName, mode, locale } }));
  }

  const consumePendingSave = useCallback(async (userId: string, eventLocale: Locale) => {
    const client = getSupabaseClient();

    if (!client) {
      return;
    }

    try {
      const rawPending = window.localStorage.getItem(pendingPlaceSaveStorageKey);
      const pending = rawPending ? (JSON.parse(rawPending) as PendingPlaceSave) : null;

      if (!pending?.placeId) {
        return;
      }

      const { error } = await client
        .from("place_saves")
        .upsert(
          {
            user_id: userId,
            place_id: pending.placeId,
          },
          { onConflict: "user_id,place_id", ignoreDuplicates: true },
        );
      if (error) {
        return;
      }

      window.localStorage.removeItem(pendingPlaceSaveStorageKey);
      window.dispatchEvent(new CustomEvent("place-save-change", { detail: { placeId: pending.placeId } }));
      await recordPlaceEvent({
        eventType: "place_save",
        placeId: pending.placeId,
        locale: eventLocale,
        userId,
        metadata: { source: "pending_login" },
      });
    } catch {
      window.localStorage.removeItem(pendingPlaceSaveStorageKey);
    }
  }, []);

  const finishLogin = useCallback(
    async (userId: string) => {
      setMessage(text.signedIn);
      await consumePendingSave(userId, locale);
      router.replace(nextPath);
      router.refresh();
    },
    [consumePendingSave, locale, nextPath, router, text.signedIn],
  );

  useEffect(() => {
    if (!loading && session) {
      void finishLogin(session.user.id);
    }
  }, [finishLogin, loading, session]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();

    if (!client) {
      setMessage(text.missingConfig);
      return;
    }

    setSubmitting(true);
    setMessage("");
    recordAuthAnalyticsEvent(authAnalyticsEventNames[mode]);

    const result =
      mode === "signin"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}${withLocale("/login", locale)}?next=${encodeURIComponent(nextPath)}`,
            },
          });

    setSubmitting(false);

    if (result.error) {
      setMessage(getAuthErrorMessage(result.error, text, mode));
      return;
    }

    if (result.data.session?.user) {
      await finishLogin(result.data.session.user.id);
      return;
    }

    updateMode("signin");
    setMessage(text.confirmEmail);
  }

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white">
          <LogIn size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">{text.email}</span>
          <span className="mt-2 flex h-12 items-center gap-2 rounded-2xl bg-slate-50 px-3 ring-1 ring-slate-200">
            <Mail size={17} className="text-slate-500" aria-hidden="true" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none"
            />
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-700">{text.password}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base text-slate-950 outline-none ring-1 ring-slate-200"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !isSupabaseConfigured}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {mode === "signin" ? <LogIn size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
          {submitLabel}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          updateMode(mode === "signin" ? "signup" : "signin");
        }}
        className="mt-4 text-sm font-bold text-teal-700"
      >
        {mode === "signin" ? text.switchToSignup : text.switchToSignin}
      </button>

      {message ? <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{message}</p> : null}
      {!isSupabaseConfigured ? <p className="mt-3 text-sm text-rose-700">{text.missingConfig}</p> : null}
    </section>
  );
}
