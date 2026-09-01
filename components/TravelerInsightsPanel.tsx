import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Flame,
  Languages,
  Leaf,
  Luggage,
  MonitorSmartphone,
  Soup,
  Toilet,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  isPlaceInformationStale,
  travelerInsightsFromPlaceInfo,
  verificationDateLabel,
} from "@/lib/traveler-insights";
import type { PlaceWithRelations, TravelerInsights } from "@/types/database";

type InsightTag = { key: string; icon: LucideIcon; tone: "positive" | "warning" | "neutral"; label: string };

const copy = {
  ko: { title: "여행자 실용정보", stale: "최근 정보가 오래되었습니다", review: "일부 정보는 재확인이 필요합니다" },
  zh: { title: "旅行实用信息", stale: "最近一次信息确认已超过较长时间", review: "部分信息需要重新确认" },
  en: { title: "Practical traveler information", stale: "This information has not been verified recently", review: "Some information needs verification" },
  ja: { title: "旅行者向け実用情報", stale: "最近の情報確認から時間が経っています", review: "一部の情報は再確認が必要です" },
} satisfies Record<Locale, { title: string; stale: string; review: string }>;

const toneClass = {
  positive: "bg-teal-50 text-teal-800 ring-teal-100",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  neutral: "bg-slate-50 text-slate-700 ring-slate-200",
};

export function TravelerInsightsPanel({ place, locale }: { place: PlaceWithRelations; locale: Locale }) {
  const info = place.china_info;
  const insights = travelerInsightsFromPlaceInfo(info);
  const tags = buildInsightTags(insights, locale);
  const dateLabel = verificationDateLabel(info?.verified_at, locale);
  const stale = isPlaceInformationStale(info?.verified_at);
  const needsReview = info?.verification_status === "needs_review";

  if (!tags.length && !dateLabel) return null;

  return (
    <section className="mt-6 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-950">{copy[locale].title}</h2>
        {dateLabel ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <CalendarCheck2 size={15} aria-hidden="true" />
            {dateLabel}
          </span>
        ) : null}
      </div>
      {tags.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map(({ key, icon: Icon, tone, label }) => (
            <span key={key} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-black ring-1 ${toneClass[tone]}`}>
              <Icon size={15} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {stale || needsReview ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
          <AlertTriangle size={16} aria-hidden="true" />
          {needsReview ? copy[locale].review : copy[locale].stale}
        </p>
      ) : null}
    </section>
  );
}

function buildInsightTags(value: Required<TravelerInsights>, locale: Locale): InsightTag[] {
  const tags: InsightTag[] = [];
  const add = (condition: boolean, key: string, icon: LucideIcon, tone: InsightTag["tone"], labels: Record<Locale, string>) => {
    if (condition) tags.push({ key, icon, tone, label: labels[locale] });
  };

  add(value.card_payment === "yes", "card", CreditCard, "positive", { ko: "카드 결제", zh: "可刷卡", en: "Card payment", ja: "カード決済" });
  add(value.card_payment === "no", "no-card", CreditCard, "warning", { ko: "카드 결제 불가", zh: "不可刷卡", en: "No card payment", ja: "カード不可" });
  add(value.cash_required === "yes", "cash", CircleDollarSign, "warning", { ko: "현금 필요", zh: "需要现金", en: "Cash required", ja: "現金が必要" });
  add(value.solo_dining === "yes", "solo", UserRound, "positive", { ko: "혼밥 가능", zh: "可单人用餐", en: "Solo friendly", ja: "一人利用可" });
  add(value.solo_dining === "no", "no-solo", UserRound, "warning", { ko: "혼밥 어려움", zh: "不适合单人用餐", en: "Not solo friendly", ja: "一人利用は難しい" });
  add(value.chinese_menu === "yes", "zh-menu", Languages, "positive", { ko: "중국어 메뉴", zh: "有中文菜单", en: "Chinese menu", ja: "中国語メニュー" });
  add(value.chinese_menu === "no", "no-zh-menu", Languages, "warning", { ko: "중국어 메뉴 없음", zh: "无中文菜单", en: "No Chinese menu", ja: "中国語メニューなし" });
  add(value.english_menu === "yes", "en-menu", Languages, "positive", { ko: "영어 메뉴", zh: "有英文菜单", en: "English menu", ja: "英語メニュー" });
  add(value.english_menu === "no", "no-en-menu", Languages, "warning", { ko: "영어 메뉴 없음", zh: "无英文菜单", en: "No English menu", ja: "英語メニューなし" });
  add(value.ordering_method === "kiosk" || value.ordering_method === "both", "kiosk", MonitorSmartphone, "neutral", { ko: "키오스크 주문", zh: "自助机点单", en: "Kiosk ordering", ja: "キオスク注文" });
  add(value.ordering_method === "staff" || value.ordering_method === "both", "staff", UsersRound, "neutral", { ko: "직원 주문", zh: "向店员点单", en: "Order with staff", ja: "スタッフ注文" });
  add(value.reservation === "recommended", "reservation-recommended", BadgeCheck, "neutral", { ko: "예약 추천", zh: "建议预约", en: "Reservation recommended", ja: "予約推奨" });
  add(value.reservation === "required", "reservation-required", BadgeCheck, "warning", { ko: "예약 필수", zh: "必须预约", en: "Reservation required", ja: "予約必須" });
  add(value.reservation === "not_needed", "reservation-not-needed", BadgeCheck, "positive", { ko: "예약 불필요", zh: "一般无需预约", en: "No reservation needed", ja: "予約不要" });
  add(value.waiting === "none", "no-waiting", Clock3, "positive", { ko: "웨이팅 거의 없음", zh: "基本无需等位", en: "Little or no wait", ja: "待ち時間ほぼなし" });
  add(value.waiting === "some", "waiting", Clock3, "neutral", { ko: "웨이팅 있음", zh: "可能需要等位", en: "Wait possible", ja: "待ち時間あり" });
  add(value.waiting === "high", "waiting-high", Clock3, "warning", { ko: "웨이팅 많음", zh: "等位较多", en: "Long waits common", ja: "待ち時間長め" });
  add(value.luggage_storage === "yes", "luggage", Luggage, "positive", { ko: "짐 보관 가능", zh: "可寄存行李", en: "Luggage storage", ja: "荷物預かり可" });
  add(value.luggage_storage === "no", "no-luggage", Luggage, "warning", { ko: "짐 보관 불가", zh: "不可寄存行李", en: "No luggage storage", ja: "荷物預かり不可" });
  add(value.toilet === "available", "toilet", Toilet, "positive", { ko: "화장실 있음", zh: "有洗手间", en: "Toilet available", ja: "トイレあり" });
  add(value.toilet === "inside", "inside-toilet", Toilet, "positive", { ko: "매장 내부 화장실", zh: "店内洗手间", en: "In-store toilet", ja: "店内トイレ" });
  add(value.toilet === "none", "no-toilet", Toilet, "warning", { ko: "화장실 없음", zh: "无洗手间", en: "No toilet", ja: "トイレなし" });
  add(value.spicy === "strong", "spicy", Flame, "warning", { ko: "매운맛 강함", zh: "辣度较高", en: "Very spicy", ja: "辛さ強め" });
  add(value.cilantro === "possible", "cilantro", Leaf, "warning", { ko: "고수 포함 가능", zh: "可能含香菜", en: "May contain cilantro", ja: "パクチー入りの場合あり" });
  add(value.spice_intensity === "strong", "spice", Soup, "warning", { ko: "향신료 강함", zh: "香料味较重", en: "Strong spices", ja: "香辛料強め" });
  add(value.portion === "large", "portion", Soup, "neutral", { ko: "양 많음", zh: "分量较大", en: "Large portions", ja: "量が多め" });
  add(value.greasiness === "possible", "greasy", Soup, "warning", { ko: "느끼할 수 있음", zh: "可能偏油腻", en: "May feel rich", ja: "脂っこく感じる場合あり" });
  add(value.tourist_friendly === "yes", "tourist", BadgeCheck, "positive", { ko: "관광객 방문 편함", zh: "游客到访方便", en: "Tourist friendly", ja: "旅行者に便利" });

  return tags;
}
