"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, type Locale, ui, withLocale } from "@/lib/i18n";
import type { PlaceSubmissionRecord, SubmissionStatus } from "@/types/database";

type MySubmissionsViewProps = {
  locale?: Locale;
};

const statusClassNames: Record<SubmissionStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  reviewing: "bg-blue-50 text-blue-700",
  approved: "bg-teal-50 text-teal-700",
  rejected: "bg-rose-50 text-rose-700",
  duplicate: "bg-amber-50 text-amber-800",
};

export function MySubmissionsView({ locale = defaultLocale }: MySubmissionsViewProps) {
  const copy = ui[locale];
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
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{copy.common.loading}</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title={copy.submissions.myTitle} description={copy.submissions.loginDescription} locale={locale} />;
  }

  return (
    <section className="space-y-3">
      {status ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}
      {submissions.length > 0 ? (
        submissions.map((submission) => {
          const label = copy.submissions.status[submission.status];

          return (
            <article key={submission.id} className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-slate-950">{submission.name || copy.submissions.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{new Date(submission.created_at).toLocaleString(locale === "ko" ? "ko-KR" : undefined)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClassNames[submission.status]}`}>{label}</span>
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
                    {copy.submissions.mapUrl}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : null}
                {submission.place_id && submission.status === "approved" ? (
                  <Link href={withLocale("/places", locale)} className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-700">
                    {copy.common.explorePlaces}
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })
      ) : (
        <div className="rounded-[24px] bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
          {copy.submissions.empty}
        </div>
      )}
    </section>
  );
}
