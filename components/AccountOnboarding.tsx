"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { accountCopy } from "@/lib/account-copy";
import { getSafeNextPath } from "@/lib/auth-flow";
import { withLocale, type Locale } from "@/lib/i18n";

export function AccountOnboarding({ locale }: { locale: Locale }) {
  const { session, profile, loading, authError, retryAuth, refreshProfile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const copy = accountCopy[locale];
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<"tourist" | "business_owner">("tourist");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const displayName = name ?? profile?.display_name ?? "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || submittingRef.current) return;
    if (!displayName.trim() || !terms || !privacy) { setMessage(copy.error); return; }
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ displayName, role, terms, privacy, marketing }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Onboarding failed");
      await refreshProfile();
      router.replace(role === "business_owner" ? withLocale("/business-application", locale) : getSafeNextPath(params.get("next"), withLocale("/", locale)));
    } catch {
      setMessage(copy.error);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading) return <p role="status">{copy.loading}</p>;
  if (authError && !profile) return <div role="alert"><p>{copy.authError}</p><button type="button" onClick={retryAuth} className="ui-button-secondary mt-4">{copy.retry}</button></div>;
  if (!session) return <AuthRequiredPanel title={copy.title} description={copy.login} locale={locale} />;

  return <form onSubmit={submit} aria-busy={submitting} className="space-y-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <p className="text-sm leading-6 text-slate-600">{copy.description}</p>
    <label className="block text-sm font-bold">{copy.name}<input required maxLength={80} autoComplete="nickname" value={displayName} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-2`} /></label>
    <label className="block text-sm font-bold">{copy.role}<select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className={`${inputClass} mt-2`}><option value="tourist">{copy.tourist}</option><option value="business_owner">{copy.owner}</option></select></label>
    <div className="flex flex-wrap items-center gap-x-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" required checked={terms} onChange={(event) => setTerms(event.target.checked)} />{copy.terms} {copy.required}</label><Link href={withLocale("/terms", locale)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-teal-800 underline">{copy.terms}</Link></div>
    <div className="flex flex-wrap items-center gap-x-2"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" required checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />{copy.privacy} {copy.required}</label><Link href={withLocale("/privacy", locale)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-teal-800 underline">{copy.privacy}</Link></div>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />{copy.marketing}</label>
    <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-2xl bg-teal-700 font-black text-white disabled:opacity-50">{submitting ? copy.saving : copy.continue}</button>
    {message ? <p role="alert" className="text-sm font-bold text-rose-700">{message}</p> : null}
  </form>;
}

const inputClass = "min-h-12 w-full rounded-2xl bg-slate-50 px-3 text-base ring-1 ring-slate-200";
