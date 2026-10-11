"use client";

import type { Provider } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, LogIn, Mail, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { pendingPlaceSaveStorageKey, type PendingPlaceSave, getSafeNextPath } from "@/lib/auth-flow";
import { recordPlaceEvent } from "@/lib/place-events";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, isLocale, type Locale, ui, withLocale } from "@/lib/i18n";

type AuthMode = "signin" | "signup";
type SocialProviderId = "kakao" | "google" | "naver";
const naverOAuthProvider = "custom:naver" satisfies Provider;

const socialProviders: Array<{
  id: SocialProviderId;
  provider: Provider;
  scopes?: string;
  brandMark: string;
  className: string;
}> = [
  {
    id: "kakao",
    provider: "kakao",
    scopes: "account_email profile_nickname profile_image",
    brandMark: "K",
    className: "bg-[#FEE500] text-[#191919] ring-[#FEE500]",
  },
  {
    id: "google",
    provider: "google",
    scopes: "openid email profile",
    brandMark: "G",
    className: "bg-white text-slate-800 ring-slate-200",
  },
  {
    id: "naver",
    provider: naverOAuthProvider,
    brandMark: "N",
    className: "bg-[#03C75A] text-white ring-[#03C75A]",
  },
];

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

function getOAuthMessage(code: string | null, text: (typeof ui)[Locale]["authFlow"]) {
  if (!code) return "";
  if (code === "access_denied" || code === "user_cancelled") return text.oauthCancelled;
  if (code === "missing_code") return text.oauthMissingCode;
  if (code === "missing_config") return text.missingConfig;
  return text.oauthErrorFallback;
}

export function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const text = ui[locale].authFlow;
  const { session, profile, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => getModeFromSearch(searchParams));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState<"tourist" | "business_owner">("tourist");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState<SocialProviderId | null>(null);
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

  useEffect(() => {
    const oauthMessage = getOAuthMessage(searchParams.get("oauth_error"), text);
    if (oauthMessage) setMessage(oauthMessage);
  }, [searchParams, text]);

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
      router.replace(profile?.onboarding_completed === false ? `${withLocale("/onboarding", locale)}?next=${encodeURIComponent(nextPath)}` : nextPath);
      router.refresh();
    },
    [consumePendingSave, locale, nextPath, profile?.onboarding_completed, router, text.signedIn],
  );

  useEffect(() => {
    if (!loading && session) {
      void finishLogin(session.user.id);
    }
  }, [finishLogin, loading, session]);

  async function startSocialLogin(providerId: SocialProviderId) {
    const client = getSupabaseClient();
    const provider = socialProviders.find((item) => item.id === providerId);

    if (!client || !provider) {
      setMessage(text.missingConfig);
      return;
    }

    setSocialSubmitting(providerId);
    setMessage("");
    recordAuthAnalyticsEvent(`auth_${providerId}_oauth_start`);

    const nextLocale = getLocaleFromPath(nextPath);
    const callbackLocale = nextLocale && isLocale(nextLocale) ? nextLocale : locale;
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);
    callbackUrl.searchParams.set("locale", callbackLocale);

    const { error } = await client.auth.signInWithOAuth({
      provider: provider.provider,
      options: {
        redirectTo: callbackUrl.toString(),
        ...(provider.scopes ? { scopes: provider.scopes } : {}),
      },
    });

    if (error) {
      setSocialSubmitting(null);
      setMessage(getAuthErrorMessage(error, text, mode));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();

    if (!client) {
      setMessage(text.missingConfig);
      return;
    }

    if (mode === "signup") {
      if (password !== passwordConfirmation) { setMessage(signupCopy[locale].passwordMismatch); return; }
      if (password.length < 8 || !/[A-Za-z]/u.test(password) || !/\d/u.test(password)) { setMessage(signupCopy[locale].passwordPolicy); return; }
      if (!displayName.trim() || !termsAccepted || !privacyAccepted) { setMessage(signupCopy[locale].required); return; }
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
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(accountType === "business_owner" ? withLocale("/business-application", locale) : nextPath)}&locale=${locale}`,
              data: { display_name: displayName.trim(), account_type: accountType, preferred_locale: locale, terms_accepted: true, privacy_accepted: true, marketing_opt_in: marketingOptIn },
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

      <div className="mt-5 space-y-2">
        {socialProviders.map((provider) => {
          const label = text.socialLogin[provider.id];
          const pending = socialSubmitting === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => void startSocialLogin(provider.id)}
              disabled={Boolean(socialSubmitting) || submitting || !isSupabaseConfigured}
              className={[
                "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black shadow-sm ring-1 transition active:scale-[0.98] disabled:opacity-50",
                provider.className,
              ].join(" ")}
            >
              {pending ? (
                <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-white/90 text-xs font-black text-slate-950 shadow-sm">
                  {provider.brandMark}
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3 text-xs font-bold text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        {text.emailDivider}
        <span className="h-px flex-1 bg-slate-200" />
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

        {mode === "signup" ? (
          <>
            <label className="block"><span className="text-sm font-bold text-slate-700">{signupCopy[locale].name}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={80} autoComplete="name" className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200" /></label>
            <label className="block"><span className="text-sm font-bold text-slate-700">{signupCopy[locale].accountType}</span><select value={accountType} onChange={(event) => setAccountType(event.target.value as typeof accountType)} className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200"><option value="tourist">{signupCopy[locale].tourist}</option><option value="business_owner">{signupCopy[locale].owner}</option></select></label>
          </>
        ) : null}

        <label className="block">
          <span className="text-sm font-bold text-slate-700">{text.password}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === "signup" ? 8 : 6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base text-slate-950 outline-none ring-1 ring-slate-200"
          />
        </label>

        {mode === "signup" ? (
          <>
            <label className="block"><span className="text-sm font-bold text-slate-700">{signupCopy[locale].confirmPassword}</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" className="mt-2 h-12 w-full rounded-2xl bg-slate-50 px-3 text-base outline-none ring-1 ring-slate-200" /></label>
            <p className="text-xs font-semibold text-slate-500">{signupCopy[locale].passwordPolicy}</p>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />{signupCopy[locale].terms}</label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} required />{signupCopy[locale].privacy}</label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} />{signupCopy[locale].marketing}</label>
          </>
        ) : null}

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

const signupCopy = {
  ko: { name: "닉네임 또는 이름", accountType: "회원 유형", tourist: "관광객", owner: "가게 사장님", confirmPassword: "비밀번호 확인", passwordPolicy: "비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.", passwordMismatch: "비밀번호 확인이 일치하지 않습니다.", required: "이름, 이용약관 및 개인정보 처리방침 동의가 필요합니다.", terms: "서비스 이용약관 동의 (필수)", privacy: "개인정보 처리방침 동의 (필수)", marketing: "마케팅 정보 수신 동의 (선택)" },
  zh: { name: "昵称或姓名", accountType: "会员类型", tourist: "游客", owner: "商家", confirmPassword: "确认密码", passwordPolicy: "密码至少8位，并包含字母和数字。", passwordMismatch: "两次密码不一致。", required: "请输入姓名并同意服务条款和隐私政策。", terms: "同意服务条款（必选）", privacy: "同意隐私政策（必选）", marketing: "同意接收营销信息（可选）" },
  en: { name: "Nickname or name", accountType: "Account type", tourist: "Traveler", owner: "Business owner", confirmPassword: "Confirm password", passwordPolicy: "Use at least 8 characters with a letter and a number.", passwordMismatch: "Passwords do not match.", required: "Name, Terms, and Privacy consent are required.", terms: "Agree to Terms (required)", privacy: "Agree to Privacy Policy (required)", marketing: "Marketing messages (optional)" },
  ja: { name: "ニックネームまたは氏名", accountType: "会員タイプ", tourist: "旅行者", owner: "店舗オーナー", confirmPassword: "パスワード確認", passwordPolicy: "英字と数字を含む8文字以上で入力してください。", passwordMismatch: "パスワードが一致しません。", required: "氏名、利用規約、プライバシーポリシーへの同意が必要です。", terms: "利用規約に同意（必須）", privacy: "プライバシーポリシーに同意（必須）", marketing: "マーケティング受信（任意）" },
} satisfies Record<Locale, Record<string, string>>;
