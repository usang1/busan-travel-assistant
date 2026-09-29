import type { Locale } from "@/lib/i18n";

export const travelerFactTypes = [
  "waiting_minutes", "foreign_card", "alipay", "wechat_pay", "chinese_menu",
  "solo_friendly", "luggage_friendly", "restroom", "sold_out", "early_closed",
  "restroom_needs_check",
  "photo_matches", "not_recommended_now", "information_changed", "closed",
  "ordering_failed", "minimum_order", "cash_only", "no_foreign_menu",
  "restroom_problem", "transport_difficult", "too_spicy", "too_oily", "portion_mismatch",
] as const;

export type TravelerFactType = (typeof travelerFactTypes)[number];
export type TravelerFact = { fact_type: TravelerFactType; fact_value: boolean | 0 | 10 | 20 | 40 };
export type TravelerVerificationState = "reported" | "verified" | "partially_verified" | "stale" | "conflicting";

export type TravelerTrustFact = {
  fact_type: TravelerFactType;
  report_count: number;
  recent_count: number;
  latest_observed_at: string;
  latest_value: boolean | number;
  verification_status: TravelerVerificationState;
};

export type TravelerTrustSummary = {
  recent_traveler_count: number;
  latest_traveler_observed_at: string | null;
  official_last_verified_at: string | null;
  admin_last_verified_at: string | null;
  conflicting_fact_count: number;
  stale_fact_count: number;
  facts: TravelerTrustFact[];
};

export type TravelerVerificationPayload = {
  placeId: string;
  locale: Locale;
  nearbyConfirmed: boolean;
  facts: TravelerFact[];
};

export type TravelerCardTrustSignal = {
  tone: "positive" | "warning" | "neutral";
  text: string;
};

const factTypeSet = new Set<string>(travelerFactTypes);
const localeSet = new Set<Locale>(["ko", "zh", "en", "ja"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTravelerVerificationPayload(value: unknown): TravelerVerificationPayload {
  if (!isRecord(value)) throw new TravelerVerificationInputError("Invalid request body.");
  const placeId = typeof value.placeId === "string" ? value.placeId : "";
  const locale = typeof value.locale === "string" ? value.locale as Locale : "ko";
  const facts = Array.isArray(value.facts) ? value.facts : [];

  if (!uuidPattern.test(placeId)) throw new TravelerVerificationInputError("Invalid place ID.");
  if (!localeSet.has(locale)) throw new TravelerVerificationInputError("Unsupported locale.");
  if (facts.length < 1 || facts.length > 8) throw new TravelerVerificationInputError("Select between one and eight facts.");

  const parsed = facts.map((fact) => parseFact(fact));
  if (new Set(parsed.map((fact) => fact.fact_type)).size !== parsed.length) {
    throw new TravelerVerificationInputError("Duplicate facts are not allowed.");
  }

  return { placeId, locale, nearbyConfirmed: value.nearbyConfirmed === true, facts: parsed };
}

export function emptyTravelerTrustSummary(): TravelerTrustSummary {
  return {
    recent_traveler_count: 0,
    latest_traveler_observed_at: null,
    official_last_verified_at: null,
    admin_last_verified_at: null,
    conflicting_fact_count: 0,
    stale_fact_count: 0,
    facts: [],
  };
}

export function getTravelerCardTrustSignal(summary: TravelerTrustSummary, locale: Locale): TravelerCardTrustSignal {
  const text = cardSignalCopy[locale];
  const currentFact = (factType: TravelerFactType) => summary.facts.find((fact) => fact.fact_type === factType
    && fact.verification_status !== "stale" && fact.verification_status !== "conflicting");
  const booleanValue = (factType: TravelerFactType) => {
    const fact = currentFact(factType);
    return fact && typeof fact.latest_value === "boolean" ? fact.latest_value : undefined;
  };
  const waiting = currentFact("waiting_minutes");

  if (booleanValue("early_closed") === true) return { tone: "warning", text: text.earlyClosed };
  if (waiting && typeof waiting.latest_value === "number" && waiting.latest_value >= 40) return { tone: "warning", text: text.longWait };
  if (booleanValue("foreign_card") === false) return { tone: "warning", text: text.noForeignCard };
  if (booleanValue("solo_friendly") === false) return { tone: "warning", text: text.soloDifficult };
  if (booleanValue("luggage_friendly") === false) return { tone: "warning", text: text.luggageDifficult };
  if (booleanValue("chinese_menu") === false) return { tone: "warning", text: text.noChineseMenu };
  if (summary.conflicting_fact_count > 0) return { tone: "warning", text: text.conflicting };
  if (summary.stale_fact_count > 0) return { tone: "warning", text: text.stale };
  if (booleanValue("restroom_needs_check") === true) return { tone: "neutral", text: text.restroomNeedsCheck };
  if (booleanValue("foreign_card") === true) return { tone: "positive", text: text.foreignCardConfirmed };
  if (summary.recent_traveler_count > 0) {
    return { tone: "positive", text: text.recentTravelers.replace("{count}", String(summary.recent_traveler_count)) };
  }
  return { tone: "neutral", text: text.insufficient };
}

export class TravelerVerificationInputError extends Error {}

function parseFact(value: unknown): TravelerFact {
  if (!isRecord(value) || typeof value.fact_type !== "string" || !factTypeSet.has(value.fact_type)) {
    throw new TravelerVerificationInputError("Unsupported fact type.");
  }
  if (value.fact_type === "waiting_minutes") {
    if (![0, 10, 20, 40].includes(Number(value.fact_value))) {
      throw new TravelerVerificationInputError("Invalid waiting time.");
    }
    return { fact_type: value.fact_type, fact_value: Number(value.fact_value) as 0 | 10 | 20 | 40 };
  }
  if (typeof value.fact_value !== "boolean") throw new TravelerVerificationInputError("Fact value must be boolean.");
  return { fact_type: value.fact_type as Exclude<TravelerFactType, "waiting_minutes">, fact_value: value.fact_value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const cardSignalCopy = {
  ko: { earlyClosed: "오늘 조기마감 제보 있음", longWait: "최근 웨이팅 긴 편", noForeignCard: "해외카드 불가 확인", soloDifficult: "혼자 방문 불편", luggageDifficult: "캐리어 이용 불편", noChineseMenu: "중국어 메뉴 없음", conflicting: "여행자 제보가 달라 재확인 중", stale: "오래된 정보 재확인 필요", restroomNeedsCheck: "화장실 정보 확인 필요", foreignCardConfirmed: "해외카드 가능 확인", recentTravelers: "최근 7일 여행자 {count}명 확인", insufficient: "최근 정보 부족" },
  zh: { earlyClosed: "有提前打烊反馈", longWait: "最近等位时间较长", noForeignCard: "已确认无法使用海外信用卡", soloDifficult: "一个人用餐不便", luggageDifficult: "携带大行李箱不便", noChineseMenu: "没有中文菜单", conflicting: "旅行者反馈不一致，正在复核", stale: "信息较旧，需要重新确认", restroomNeedsCheck: "洗手间信息待确认", foreignCardConfirmed: "已确认可用海外信用卡", recentTravelers: "最近7天有{count}位旅行者确认", insufficient: "近期信息不足" },
  en: { earlyClosed: "Early closing reported today", longWait: "Recent waits are long", noForeignCard: "Foreign cards reported unavailable", soloDifficult: "Solo visits may be difficult", luggageDifficult: "Large luggage is difficult", noChineseMenu: "No Chinese menu", conflicting: "Traveler reports conflict", stale: "Information needs rechecking", restroomNeedsCheck: "Restroom details need checking", foreignCardConfirmed: "Foreign cards confirmed", recentTravelers: "Confirmed by {count} travelers in 7 days", insufficient: "Not enough recent information" },
  ja: { earlyClosed: "本日の早仕舞い情報あり", longWait: "最近は待ち時間が長め", noForeignCard: "海外カード利用不可を確認", soloDifficult: "一人利用は不便", luggageDifficult: "大型荷物は不便", noChineseMenu: "中国語メニューなし", conflicting: "旅行者情報が一致せず再確認中", stale: "古い情報の再確認が必要", restroomNeedsCheck: "トイレ情報は確認が必要", foreignCardConfirmed: "海外カード利用可を確認", recentTravelers: "直近7日間に旅行者{count}人が確認", insufficient: "最近の情報が不足" },
} satisfies Record<Locale, Record<string, string>>;
