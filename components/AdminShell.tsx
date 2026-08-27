"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, ShieldCheck } from "lucide-react";
import { AdminCorrectionWorkflow } from "@/components/AdminCorrectionWorkflow";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminPlaceManager } from "@/components/AdminPlaceManager";
import { AdminSubmissionWorkflow } from "@/components/AdminSubmissionWorkflow";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { PlaceListResult, PlaceWithRelations } from "@/types/database";
import type { PhotoSpotRecord } from "@/types/database";

export function AdminShell() {
  const { session, loading } = useAuth();
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
    return <AdminState title="관리자 확인 중" description="로그인 세션과 관리자 권한을 확인하고 있습니다." />;
  }

  if (!session) {
    return (
      <AdminState title="로그인이 필요합니다" description="관리자 영역은 Supabase Auth 로그인 후 접근할 수 있습니다.">
        <Link href="/login?next=/admin" className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white">
          <LogIn size={17} aria-hidden="true" />
          로그인
        </Link>
      </AdminState>
    );
  }

  if (!authorized) {
    return <AdminState title="접근할 수 없습니다" description={error || "관리자 권한이 필요합니다."} />;
  }

  return (
    <div className="space-y-8">
      <AdminDashboard places={places} photoSpots={[] as PhotoSpotRecord[]} />
      <AdminSubmissionWorkflow accessToken={accessToken as string} onPlaceCreated={loadPlaces} />
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
      <h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {children}
    </section>
  );
}
