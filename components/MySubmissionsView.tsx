"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, type Locale, withLocale } from "@/lib/i18n";
import type { PlaceSubmissionRecord, SubmissionStatus } from "@/types/database";

type MySubmissionsViewProps = {
  locale?: Locale;
};

const statusLabels: Record<SubmissionStatus, { label: string; className: string }> = {
  pending: { label: "대기", className: "bg-slate-100 text-slate-700" },
  reviewing: { label: "검토중", className: "bg-blue-50 text-blue-700" },
  approved: { label: "승인", className: "bg-teal-50 text-teal-700" },
  rejected: { label: "거절", className: "bg-rose-50 text-rose-700" },
  duplicate: { label: "중복", className: "bg-amber-50 text-amber-800" },
};

export function MySubmissionsView({ locale = defaultLocale }: MySubmissionsViewProps) {
  const { user, loading } = useAuth();
  const [submissions, setSubmissions] = useState<PlaceSubmissionRecord[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSubmissions() {
      const client = getSupabaseClient();

      if (!client || !user) {
        setSubmissions([]);
        return;
      }

      const { data, error } = await client
        .from("place_submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) {
        return;
      }

      if (error) {
        setStatus(error.message);
        return;
      }

      setSubmissions((data ?? []) as PlaceSubmissionRecord[]);
    }

    void loadSubmissions();

    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Loading...</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title="내 제보" description="로그인 후 제출한 장소 제보 상태를 확인할 수 있습니다." locale={locale} />;
  }

  return (
    <section className="space-y-3">
      {status ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}
      {submissions.length > 0 ? (
        submissions.map((submission) => {
          const label = statusLabels[submission.status];

          return (
            <article key={submission.id} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-slate-950">{submission.name || "지도 링크 제보"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{new Date(submission.created_at).toLocaleString("ko-KR")}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${label.className}`}>{label.label}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{submission.recommendation_reason || submission.notes}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <span className="rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">{submission.provider}</span>
                {submission.source_url ? (
                  <a
                    href={submission.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-teal-700 ring-1 ring-slate-200"
                  >
                    지도 링크
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : null}
                {submission.place_id && submission.status === "approved" ? (
                  <Link href={withLocale("/places", locale)} className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-700">
                    서비스에서 보기
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })
      ) : (
        <div className="rounded-[24px] bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
          아직 제출한 장소 제보가 없습니다.
        </div>
      )}
    </section>
  );
}
