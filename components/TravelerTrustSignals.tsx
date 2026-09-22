"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CalendarClock, Users } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { emptyTravelerTrustSummary, type TravelerFactType, type TravelerTrustSummary } from "@/lib/traveler-verification";

export function TravelerTrustSignals({ placeId, locale }: { placeId: string; locale: Locale }) {
  const [summary, setSummary] = useState<TravelerTrustSummary>(emptyTravelerTrustSummary());

  useEffect(() => {
    let mounted = true;
    fetch(`/api/traveler-verifications?placeId=${encodeURIComponent(placeId)}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ summary?: TravelerTrustSummary }> : null)
      .then((body) => { if (mounted && body?.summary) setSummary(body.summary); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, [placeId]);

  const hasSignals = summary.recent_traveler_count > 0 || summary.official_last_verified_at || summary.admin_last_verified_at
    || summary.conflicting_fact_count > 0 || summary.stale_fact_count > 0 || summary.facts.length > 0;
  if (!hasSignals) return null;

  const text = copy[locale];
  const latestVerifiedAt = summary.official_last_verified_at ?? summary.admin_last_verified_at;

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4" aria-labelledby={`trust-signals-${placeId}`}>
      <div className="flex items-center gap-2">
        <BadgeCheck size={19} className="text-teal-700" aria-hidden="true" />
        <h2 id={`trust-signals-${placeId}`} className="font-black text-slate-950">{text.title}</h2>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {latestVerifiedAt ? <Signal icon={BadgeCheck} text={`${summary.official_last_verified_at ? text.official : text.admin} · ${formatDate(latestVerifiedAt, locale)}`} /> : null}
        {summary.recent_traveler_count > 0 ? <Signal icon={Users} text={text.travelers.replace("{count}", String(summary.recent_traveler_count))} /> : null}
        {summary.conflicting_fact_count > 0 ? <Signal icon={AlertTriangle} tone="warning" text={text.conflict.replace("{count}", String(summary.conflicting_fact_count))} /> : null}
        {summary.stale_fact_count > 0 ? <Signal icon={CalendarClock} tone="warning" text={text.stale.replace("{count}", String(summary.stale_fact_count))} /> : null}
      </div>
      {summary.facts.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.facts.slice(0, 4).map((fact) => (
            <span key={fact.fact_type} className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
              {factLabels[fact.fact_type]?.[locale] ?? fact.fact_type} · {statusLabels[fact.verification_status][locale]}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-slate-500">{text.note}</p>
    </section>
  );
}

function Signal({ icon: Icon, text, tone = "default" }: { icon: typeof BadgeCheck; text: string; tone?: "default" | "warning" }) {
  return <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-bold ${tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-teal-50 text-teal-900"}`}><Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{text}</p>;
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

const copy = {
  ko: { title: "정보 신뢰도", official: "공식 정보", admin: "운영자 확인", travelers: "최근 7일 여행자 {count}명 확인", conflict: "{count}개 항목의 제보가 서로 달라 재확인 중", stale: "{count}개 항목이 오래되어 재확인 필요", note: "여행자 확인은 관리자 승인 후 집계하며, 서로 다른 제보는 하나로 덮어쓰지 않습니다." },
  zh: { title: "信息可信度", official: "官方信息", admin: "运营者确认", travelers: "最近7天有{count}位旅行者确认", conflict: "{count}项反馈互相冲突，正在复核", stale: "{count}项信息较旧，需要复核", note: "旅行者反馈经管理员审核后才会统计，冲突反馈不会直接互相覆盖。" },
  en: { title: "Information confidence", official: "Official information", admin: "Administrator verified", travelers: "Confirmed by {count} travelers in the last 7 days", conflict: "{count} facts have conflicting reports and need review", stale: "{count} facts are old and need rechecking", note: "Traveler checks count only after moderation. Conflicting reports never overwrite each other automatically." },
  ja: { title: "情報の信頼性", official: "公式情報", admin: "運営者確認", travelers: "直近7日間に旅行者{count}人が確認", conflict: "{count}項目の投稿が矛盾しており再確認中", stale: "{count}項目が古く再確認が必要", note: "旅行者の確認は管理者承認後に集計し、矛盾する投稿を自動で上書きしません。" },
} satisfies Record<Locale, Record<string, string>>;

const statusLabels = {
  verified: { ko: "여행자 확인", zh: "旅行者已确认", en: "Traveler verified", ja: "旅行者確認済み" },
  partially_verified: { ko: "확인 1~2건", zh: "1至2次确认", en: "1-2 checks", ja: "確認1〜2件" },
  stale: { ko: "오래된 정보", zh: "信息较旧", en: "Stale", ja: "古い情報" },
  conflicting: { ko: "정보 충돌", zh: "信息冲突", en: "Conflicting", ja: "情報が矛盾" },
} satisfies Record<string, Record<Locale, string>>;

const factLabels: Partial<Record<TravelerFactType, Record<Locale, string>>> = {
  waiting_minutes: { ko: "웨이팅", zh: "等位", en: "Wait", ja: "待ち時間" },
  foreign_card: { ko: "해외카드", zh: "海外信用卡", en: "Foreign card", ja: "海外カード" },
  alipay: { ko: "알리페이", zh: "支付宝", en: "Alipay", ja: "Alipay" },
  wechat_pay: { ko: "위챗페이", zh: "微信支付", en: "WeChat Pay", ja: "WeChat Pay" },
  chinese_menu: { ko: "중국어 메뉴", zh: "中文菜单", en: "Chinese menu", ja: "中国語メニュー" },
  solo_friendly: { ko: "혼자 방문", zh: "一个人", en: "Solo visit", ja: "一人利用" },
  luggage_friendly: { ko: "캐리어", zh: "大行李箱", en: "Luggage", ja: "大型荷物" },
  restroom: { ko: "화장실", zh: "洗手间", en: "Restroom", ja: "トイレ" },
  sold_out: { ko: "재료 소진", zh: "售罄", en: "Sold out", ja: "売り切れ" },
  early_closed: { ko: "조기 마감", zh: "提前打烊", en: "Early closing", ja: "早仕舞い" },
  photo_matches: { ko: "사진과 실제", zh: "照片与实际", en: "Photo match", ja: "写真と実物" },
};
