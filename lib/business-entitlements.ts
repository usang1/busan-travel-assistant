export const BUSINESS_FEATURES = {
  basicAnalytics: "basic_analytics",
  detailedAnalytics: "detailed_analytics",
  periodComparison: "period_comparison",
  reportDownload: "report_download",
  couponAnalytics: "coupon_analytics",
  automaticReports: "automatic_reports",
} as const;

export type BusinessFeature = typeof BUSINESS_FEATURES[keyof typeof BUSINESS_FEATURES];
export type BusinessPlanCode = "free" | "pro" | "business";

export const BUSINESS_PLAN_FEATURES: Record<BusinessPlanCode, Record<BusinessFeature, boolean>> = {
  free: {
    basic_analytics: true,
    detailed_analytics: false,
    period_comparison: false,
    report_download: false,
    coupon_analytics: false,
    automatic_reports: false,
  },
  pro: {
    basic_analytics: true,
    detailed_analytics: true,
    period_comparison: true,
    report_download: true,
    coupon_analytics: false,
    automatic_reports: false,
  },
  business: {
    basic_analytics: true,
    detailed_analytics: true,
    period_comparison: true,
    report_download: true,
    coupon_analytics: true,
    automatic_reports: true,
  },
};

export type ResolvedBusinessEntitlement = {
  planCode: BusinessPlanCode;
  planName: string;
  status: "free" | "trial" | "active";
  endsAt: string | null;
  features: Record<BusinessFeature, boolean>;
};

export function resolveBusinessEntitlement(rows: Array<{
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  place_id?: string | null;
  subscription_plans?: { code?: string | null; name?: string | null; features?: Record<string, unknown> | null } | null;
}>, placeId: string, now = new Date()): ResolvedBusinessEntitlement {
  const current = rows.find((row) => {
    const startsAt = row.starts_at ? new Date(row.starts_at) : null;
    const endsAt = row.ends_at ? new Date(row.ends_at) : null;
    return (row.status === "active" || row.status === "trial")
      && (!startsAt || startsAt <= now)
      && (!endsAt || endsAt > now)
      && (!row.place_id || row.place_id === placeId);
  });
  const code = normalizePlanCode(current?.subscription_plans?.code);
  const configured = current?.subscription_plans?.features ?? {};
  return {
    planCode: code,
    planName: current?.subscription_plans?.name || titleCase(code),
    status: current?.status === "trial" ? "trial" : current ? "active" : "free",
    endsAt: current?.ends_at ?? null,
    features: Object.fromEntries(Object.keys(BUSINESS_PLAN_FEATURES.free).map((feature) => [
      feature,
      typeof configured[feature] === "boolean" ? configured[feature] : BUSINESS_PLAN_FEATURES[code][feature as BusinessFeature],
    ])) as Record<BusinessFeature, boolean>,
  };
}

function normalizePlanCode(value: string | null | undefined): BusinessPlanCode {
  return value === "pro" || value === "business" ? value : "free";
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
