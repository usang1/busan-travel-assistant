"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { mergeGuestDataToAccount } from "@/lib/guest-sync";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, type Locale } from "@/lib/i18n";

export type UserProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  preferred_locale: Locale;
  created_at: string;
  updated_at: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string;
  guestMergePending: boolean;
  refreshProfile: () => Promise<void>;
  retryAuth: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  authError: "",
  guestMergePending: false,
  refreshProfile: async () => undefined,
  retryAuth: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [guestMergePending, setGuestMergePending] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  async function loadProfile(userId: string) {
    const client = getSupabaseClient();

    if (!client) {
      setProfile(null);
      return;
    }

    const { data, error } = await client
      .from("profiles")
      .select("id, display_name, avatar_url, role, preferred_locale, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      setProfile(null);
      return;
    }

    setProfile(data as UserProfile);
  }

  async function refreshProfile() {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    await loadProfile(session.user.id);
  }

  useEffect(() => {
    const client = getSupabaseClient();

    if (!client) {
      setLoading(false);
      return;
    }

    let mounted = true;

    setLoading(true);
    setAuthError("");

    withTimeout(client.auth.getSession(), 8000)
      .then(({ data }) => {
        if (!mounted) {
          return;
        }

        setSession(data.session);
        if (data.session?.user) {
          void loadProfile(data.session.user.id).finally(() => {
            if (mounted) {
              setLoading(false);
            }
          });
          return;
        }

        setProfile(null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setAuthError("로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
        setLoading(false);
      });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthError("");
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id).finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
        return;
      }

      setProfile(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [retryNonce]);

  useEffect(() => {
    if (!session?.user || loading) return;

    let cancelled = false;
    const locale = getLocaleFromPath(window.location.pathname) ?? profile?.preferred_locale ?? defaultLocale;

    setGuestMergePending(true);
    void mergeGuestDataToAccount(session.user.id, locale)
      .then((result) => {
        if (!cancelled && result.error) {
          setAuthError("저장한 게스트 데이터를 계정에 병합하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      })
      .finally(() => {
        if (!cancelled) setGuestMergePending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.preferred_locale, session?.user]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === "admin",
      loading,
      authError,
      guestMergePending,
      refreshProfile,
      retryAuth: async () => setRetryNonce((current) => current + 1),
    }),
    [authError, guestMergePending, loading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Auth request timed out.")), timeoutMs);
    }),
  ]);
}
