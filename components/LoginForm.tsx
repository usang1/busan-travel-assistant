"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogIn, Mail, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { pendingPlaceSaveStorageKey, type PendingPlaceSave, getSafeNextPath } from "@/lib/auth-flow";
import { recordPlaceEvent } from "@/lib/place-events";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, type Locale, withLocale } from "@/lib/i18n";

type AuthMode = "signin" | "signup";

const copy: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    signin: string;
    signup: string;
    switchToSignup: string;
    switchToSignin: string;
    missingConfig: string;
    confirmEmail: string;
    emailRateLimited: string;
    signedIn: string;
  }
> = {
  zh: {
    title: "登录",
    subtitle: "登录后可以保存地点、查看我的收藏、提交地点和修改请求。",
    email: "邮箱",
    password: "密码",
    signin: "登录",
    signup: "注册",
    switchToSignup: "没有账号？注册",
    switchToSignin: "已有账号？登录",
    missingConfig: "Supabase 环境变量未配置。",
    confirmEmail: "已发送注册确认邮件。请点击邮件中的确认链接后再登录。",
    emailRateLimited: "注册确认邮件发送次数已达上限。请约 1 小时后再试，或配置自定义 SMTP 后提高发送限制。",
    signedIn: "已登录，正在返回。",
  },
  en: {
    title: "Sign in",
    subtitle: "Sign in to save places, view your saved list, and send place updates.",
    email: "Email",
    password: "Password",
    signin: "Sign in",
    signup: "Create account",
    switchToSignup: "No account? Sign up",
    switchToSignin: "Have an account? Sign in",
    missingConfig: "Supabase environment variables are not configured.",
    confirmEmail: "We sent a confirmation email. Open the link in that email, then sign in.",
    emailRateLimited: "The signup email limit has been reached. Try again in about 1 hour, or configure custom SMTP to raise the limit.",
    signedIn: "Signed in. Returning now.",
  },
  ja: {
    title: "ログイン",
    subtitle: "ログインするとスポット保存、保存一覧、情報提供、修正依頼が使えます。",
    email: "メール",
    password: "パスワード",
    signin: "ログイン",
    signup: "登録",
    switchToSignup: "アカウントがない場合は登録",
    switchToSignin: "アカウントがある場合はログイン",
    missingConfig: "Supabase環境変数が設定されていません。",
    confirmEmail: "登録確認メールを送信しました。メール内の確認リンクを開いてからログインしてください。",
    emailRateLimited: "登録確認メールの送信上限に達しました。約1時間後に再試行するか、カスタムSMTPを設定して上限を引き上げてください。",
    signedIn: "ログインしました。戻ります。",
  },
  ko: {
    title: "로그인",
    subtitle: "로그인하면 장소 저장, 내 저장, 장소 제보, 정보 수정 요청을 사용할 수 있습니다.",
    email: "이메일",
    password: "비밀번호",
    signin: "로그인",
    signup: "회원가입",
    switchToSignup: "계정이 없나요? 회원가입",
    switchToSignin: "계정이 있나요? 로그인",
    missingConfig: "Supabase 환경 변수가 설정되지 않았습니다.",
    confirmEmail: "회원가입 확인 메일을 보냈습니다. 메일의 확인 링크를 연 뒤 로그인해 주세요.",
    emailRateLimited: "회원가입 확인 메일 발송 한도를 초과했습니다. 약 1시간 후 다시 시도하거나, 커스텀 SMTP를 설정해 발송 한도를 늘려 주세요.",
    signedIn: "로그인되었습니다. 원래 화면으로 돌아갑니다.",
  },
};

type AuthDisplayError = {
  code?: string;
  message?: string;
  status?: number;
};

function getAuthErrorMessage(error: AuthDisplayError, text: (typeof copy)[Locale]) {
  const message = error.message ?? "";
  const normalizedMessage = message.toLowerCase();
  const isEmailRateLimit =
    error.code === "over_email_send_rate_limit" ||
    error.status === 429 ||
    normalizedMessage.includes("email rate limit") ||
    normalizedMessage.includes("rate limit exceeded");

  return isEmailRateLimit ? text.emailRateLimited : message;
}

export function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname) ?? defaultLocale;
  const text = copy[locale];
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextPath = useMemo(
    () => getSafeNextPath(searchParams.get("next"), withLocale("/saved", locale)),
    [locale, searchParams],
  );

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
      setMessage(getAuthErrorMessage(result.error, text));
      return;
    }

    if (result.data.session?.user) {
      await finishLogin(result.data.session.user.id);
      return;
    }

    setMode("signin");
    setMessage(text.confirmEmail);
  }

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white">
          <LogIn size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">{text.title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">{text.subtitle}</p>
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
          {mode === "signin" ? text.signin : text.signup}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((current) => (current === "signin" ? "signup" : "signin"));
          setMessage("");
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
