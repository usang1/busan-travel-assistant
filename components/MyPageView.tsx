"use client";

import Link from "next/link";
import { CalendarDays, LogOut, Mail, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { MySubmissionsView } from "@/components/MySubmissionsView";
import { SavedItemsView } from "@/components/SavedItemsView";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseClient } from "@/lib/supabase";
import { type Locale, ui, withLocale } from "@/lib/i18n";

type MyPageViewProps = {
  locale: Locale;
};

export function MyPageView({ locale }: MyPageViewProps) {
  const { user, profile, isAdmin, loading } = useAuth();
  const copy = ui[locale];

  async function signOut() {
    const client = getSupabaseClient();

    if (!client) {
      return;
    }

    await client.auth.signOut();
  }

  if (loading) {
    return <div className="rounded-[24px] bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{copy.common.loading}</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title={copy.mypage.title} description={copy.submissions.loginDescription} locale={locale} />;
  }

  const joinedAt = profile?.created_at ?? user.created_at;
  const nickname = profile?.display_name || user.email?.split("@")[0] || "-";

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
              <UserRound size={24} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-950">{copy.mypage.profile}</h2>
            <p className="mt-1 text-sm text-slate-500">{copy.mypage.settingsUnavailable}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Link
                href={withLocale("/admin", locale)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {copy.auth.admin}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-50 px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition active:scale-95"
            >
              <LogOut size={16} aria-hidden="true" />
              {copy.auth.logout}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ProfileItem icon={Mail} label={copy.mypage.email} value={user.email ?? "-"} />
          <ProfileItem icon={UserRound} label={copy.mypage.nickname} value={nickname} />
          <ProfileItem icon={CalendarDays} label={copy.mypage.joinedAt} value={joinedAt ? new Date(joinedAt).toLocaleDateString(locale === "ko" ? "ko-KR" : undefined) : "-"} />
        </div>
        <p className="mt-4 inline-flex rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          {copy.mypage.role}: {profile?.role ?? "user"}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-black text-slate-950">{copy.mypage.savedPlaces}</h2>
        <div className="mt-4">
          <SavedItemsView locale={locale} compact />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-black text-slate-950">{copy.mypage.mySubmissions}</h2>
        <div className="mt-4">
          <MySubmissionsView locale={locale} />
        </div>
      </section>
    </div>
  );
}

function ProfileItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <Icon size={17} className="text-teal-700" aria-hidden="true" />
      <p className="mt-2 text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
