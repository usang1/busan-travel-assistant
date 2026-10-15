import { BadgeCheck, CalendarClock, FileSearch } from "lucide-react";
import { placeFieldLabels, verificationStatusLabel, type PublicPlaceFieldVerification } from "@/lib/place-field-verification";
import type { Locale } from "@/lib/i18n";

const copy = {
  ko: { title: "정보별 확인 상태", description: "각 항목은 표시된 출처와 날짜 범위에서만 확인되었습니다.", collected: "자동 수집", verified: "확인", source: "출처" },
  zh: { title: "各项信息的确认状态", description: "每项信息仅在所示来源和日期范围内得到确认。", collected: "自动收集", verified: "确认", source: "来源" },
  en: { title: "Verification by field", description: "Each item is verified only for the source and date shown.", collected: "Collected", verified: "Checked", source: "Source" },
  ja: { title: "項目別の確認状況", description: "各項目は表示された出典と日付の範囲で確認されています。", collected: "自動収集", verified: "確認", source: "出典" },
} satisfies Record<Locale, Record<string, string>>;

export function PlaceFieldVerificationSummary({ rows, locale }: { rows: PublicPlaceFieldVerification[]; locale: Locale }) {
  if (!rows.length) return null;
  const text = copy[locale];
  return (
    <section className="rounded-[28px] border border-[#e8e4dd] bg-[#faf8f3] p-5 sm:p-6">
      <div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-800"><BadgeCheck size={20} aria-hidden="true" /></div><div><h2 className="text-lg font-black text-slate-950">{text.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{text.description}</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const date = row.verified_at ?? row.collected_at;
          const source = row.provider || sourceLabel(row.source_type, locale);
          return <article key={row.field_name} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{placeFieldLabels[row.field_name]}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${row.verification_status === "needs_recheck" ? "bg-amber-100 text-amber-800" : "bg-teal-50 text-teal-800"}`}>{verificationStatusLabel(row.verification_status, locale)}</span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><FileSearch size={14} />{text.source}: {source}</span>{date ? <span className="inline-flex items-center gap-1"><CalendarClock size={14} />{row.verified_at ? text.verified : text.collected}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(date))}</span> : null}</div></article>;
        })}
      </div>
    </section>
  );
}

function sourceLabel(source: PublicPlaceFieldVerification["source_type"], locale: Locale) {
  const labels = {
    ko: { map_api: "지도 API", official_website: "공식 홈페이지", official_menu: "공식 메뉴판", owner: "사업자", admin: "관리자", field_visit: "직접 방문", csv: "CSV", manual: "수동 입력" },
    zh: { map_api: "地图 API", official_website: "官方网站", official_menu: "官方菜单", owner: "商家", admin: "管理员", field_visit: "实地到访", csv: "CSV", manual: "手动输入" },
    en: { map_api: "Map API", official_website: "Official website", official_menu: "Official menu", owner: "Owner", admin: "Admin", field_visit: "Field visit", csv: "CSV", manual: "Manual entry" },
    ja: { map_api: "地図 API", official_website: "公式サイト", official_menu: "公式メニュー", owner: "事業者", admin: "管理者", field_visit: "現地訪問", csv: "CSV", manual: "手動入力" },
  } as const;
  return labels[locale][source];
}
