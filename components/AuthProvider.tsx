"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n";

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
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

    client.auth.getSession().then(({ data }) => {
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
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === "admin",
      loading,
      refreshProfile,
    }),
    [loading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
