"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, ShieldCheck } from "lucide-react";
import { AdminCorrectionWorkflow } from "@/components/AdminCorrectionWorkflow";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminGuideManager } from "@/components/AdminGuideManager";
import { AdminPlaceManager } from "@/components/AdminPlaceManager";
import { AdminSubmissionWorkflow } from "@/components/AdminSubmissionWorkflow";
import { AdminTravelerDecisionManager } from "@/components/AdminTravelerDecisionManager";
import { AdminTravelerReportWorkflow } from "@/components/AdminTravelerReportWorkflow";
import { useAuth } from "@/components/AuthProvider";
import { defaultLocale, type Locale, ui, withLocale } from "@/lib/i18n";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { PlaceListResult, PlaceWithRelations } from "@/types/database";
import type { PhotoSpotRecord } from "@/types/database";

export function AdminShell({ locale = defaultLocale }: { locale?: Locale }) {
  const { session, loading } = useAuth();
  const copy = ui[locale].admin;
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [places, setPlaces] = useState<PlaceWithRelations[]>([]);
  const [source, setSource] = useState<PlaceListResult["source"]>("demo");
  const [error, setError] = useState("");

  const accessToken = session?.access_token;

  const adminFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      if (!accessToken) {
        throw new Error("로그인이 필요합니다.");
      }

      return fetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
    [accessToken],
  );

  const loadPlaces = useCallback(async () => {
    const response = await adminFetch("/api/admin/places");

    if (!response.ok) {
      const body = (await response.json()) as { message?: string };
      throw new Error(body.message ?? "장소 목록을 불러오지 못했습니다.");
    }

    const body = (await response.json()) as PlaceListResult;
    setPlaces(body.places);
    setSource(body.source);
    setError(body.error ?? "");
  }, [adminFetch]);

  useEffect(() => {
    let mounted = true;

    async function verifyAdmin() {
      if (loading) {
        return;
      }

      if (!accessToken) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      setChecking(true);

      try {
        const response = await adminFetch("/api/admin/me");

        if (!response.ok) {
          setAuthorized(false);
          return;
        }

        await loadPlaces();

        if (mounted) {
          setAuthorized(true);
        }
      } catch (verifyError) {
        if (mounted) {
          setAuthorized(false);
          setError(verifyError instanceof Error ? verifyError.message : "관리자 확인에 실패했습니다.");
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    void verifyAdmin();

    return () => {
      mounted = false;
    };
  }, [accessToken, adminFetch, loadPlaces, loading]);

  if (loading || checking) {
    return <AdminState title={copy.checkingTitle} description={copy.checkingDescription} />;
  }

  if (!session) {
    const adminPath = withLocale("/admin", locale);

    return (
      <AdminState title={copy.loginTitle} description={copy.loginDescription}>
        <Link href={`${withLocale("/login", locale)}?next=${encodeURIComponent(adminPath)}`} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white">
          <LogIn size={17} aria-hidden="true" />
          {ui[locale].auth.login}
        </Link>
      </AdminState>
    );
  }

  if (!authorized) {
    return <AdminState title={copy.forbiddenTitle} description={error || copy.forbiddenDescription} />;
  }

  return (
    <div className="space-y-8">
      <nav aria-label={copy.menu} className="flex flex-wrap gap-2">
        <a href="#traveler-decision" className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-bold text-white">여행자 데이터</a>
        <a href="#traveler-reports" className="inline-flex min-h-11 items-center rounded-lg bg-amber-600 px-4 text-sm font-bold text-white">현장 제보 검수</a>
        <a href="#guides" className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-bold text-white">{copy.guides}</a>
      </nav>
      <AdminDashboard places={places} photoSpots={[] as PhotoSpotRecord[]} />
      <AdminTravelerReportWorkflow accessToken={accessToken as string} />
      <AdminTravelerDecisionManager accessToken={accessToken as string} places={places} />
      <AdminGuideManager accessToken={accessToken as string} places={places} />
      <AdminSubmissionWorkflow accessToken={accessToken as string} places={places} onPlaceCreated={loadPlaces} />
      <AdminCorrectionWorkflow accessToken={accessToken as string} />
      <AdminPlaceManager
        initialPlaces={places}
        source={source}
        error={error}
        supabaseConfigured={isSupabaseConfigured}
        adminAccessToken={accessToken}
      />
    </div>
  );
}

function AdminState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
        <ShieldCheck size={22} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-2xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {children}
    </section>
  );
}
