import type { Locale } from "@/lib/i18n";

export const travelerFactTypes = [
  "waiting_minutes", "foreign_card", "alipay", "wechat_pay", "chinese_menu",
  "solo_friendly", "luggage_friendly", "restroom", "sold_out", "early_closed",
  "photo_matches", "not_recommended_now", "information_changed", "closed",
  "ordering_failed", "minimum_order", "cash_only", "no_foreign_menu",
  "restroom_problem", "transport_difficult", "too_spicy", "too_oily", "portion_mismatch",
] as const;

export type TravelerFactType = (typeof travelerFactTypes)[number];
export type TravelerFact = { fact_type: TravelerFactType; fact_value: boolean | 0 | 10 | 20 | 40 };
export type TravelerVerificationState = "verified" | "partially_verified" | "stale" | "conflicting";

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
