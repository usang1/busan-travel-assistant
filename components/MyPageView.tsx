"use client";

import Link from "next/link";
import { CalendarDays, Flag, LogOut, Mail, ShieldCheck, Store, UserRound, type LucideIcon } from "lucide-react";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { MySubmissionsView } from "@/components/MySubmissionsView";
import { MyTripsPanel } from "@/components/MyTripsPanel";
import { SavedGuides } from "@/components/SavedGuides";
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
    return <div className="border border-[#e8e4dd] bg-white p-5 text-sm font-semibold text-[#6f746e]">{copy.common.loading}</div>;
  }

  if (!user) {
    return <AuthRequiredPanel title={copy.mypage.loginTitle} description={copy.authFlow.signinDescription} locale={locale} />;
  }

  const joinedAt = profile?.created_at ?? user.created_at;
  const email = profile?.email || user.email || "-";
  const nickname = profile?.display_name || user.email?.split("@")[0] || "-";

  return (
    <div className="space-y-6">
      <section className="border border-[#e8e4dd] bg-white p-5 shadow-[0_18px_50px_rgba(37,40,36,0.06)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="grid size-12 place-items-center bg-[#edf2eb] text-[#4f6652]">
              <UserRound size={24} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.035em] text-[#252824]">{copy.mypage.profile}</h2>
            <p className="mt-1 text-sm text-slate-500">{copy.mypage.settingsUnavailable}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile?.role === "business_owner" ? <Link href={withLocale("/business/dashboard", locale)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-indigo-700 px-4 text-sm font-black text-white"><Store size={16} aria-hidden="true" />{{ ko: "내 가게 관리", zh: "我的店铺", en: "My business", ja: "店舗管理" }[locale]}</Link> : null}
            {isAdmin ? (
              <Link
                href={withLocale("/admin", locale)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white transition active:scale-95"
              >
                <ShieldCheck size={16} aria-hidden="true" />
                {copy.auth.admin}
              </Link>
            ) : null}
            <Link
              href={withLocale("/contact", locale)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-teal-50 px-4 text-sm font-black text-teal-700 ring-1 ring-teal-100 transition active:scale-95"
            >
              <Flag size={16} aria-hidden="true" />
              {copy.common.submitPlace}
            </Link>
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
          <ProfileItem icon={Mail} label={copy.mypage.email} value={email} />
          <ProfileItem icon={UserRound} label={copy.mypage.nickname} value={nickname} />
          <ProfileItem icon={CalendarDays} label={copy.mypage.joinedAt} value={joinedAt ? new Date(joinedAt).toLocaleDateString(locale === "ko" ? "ko-KR" : undefined) : "-"} />
        </div>
        <p className="mt-4 inline-flex rounded-full bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          {copy.mypage.role}: {profile?.role ?? "user"}
        </p>
      </section>

      <MyTripsPanel locale={locale} />

      <section>
        <h2 className="text-xl font-black text-slate-950">{copy.mypage.savedPlaces}</h2>
        <div className="mt-4">
          <SavedItemsView locale={locale} compact />
          <SavedGuides locale={locale} />
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
    <div className="border border-[#e8e4dd] bg-[#faf9f6] p-4">
      <Icon size={17} className="text-[#4f6652]" aria-hidden="true" />
      <p className="mt-2 text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
