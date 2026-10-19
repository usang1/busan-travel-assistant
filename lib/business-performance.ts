export type BusinessPerformanceRpcRow = {
  row_kind: "metric" | "channel" | "locale" | "daily" | "coupon" | "coupon_stage";
  event_name: string;
  dimension: string;
  dimension_value: string;
  stat_date: string | null;
  event_count: number | string;
  unique_visitors: number | string;
};

export type BusinessMetricValue = { count: number; unique: number };
export type BusinessPerformance = {
  metrics: {
    placeViews: BusinessMetricValue;
    saves: BusinessMetricValue;
    directions: BusinessMetricValue;
    phoneClicks: BusinessMetricValue;
    couponImpressions: BusinessMetricValue;
    couponViews: BusinessMetricValue;
    couponClaims: BusinessMetricValue;
    couponRedemptions: BusinessMetricValue;
    saveConversionRate: number | null;
    couponClaimRate: number | null;
    couponRedemptionRate: number | null;
  };
  channels: Array<{ value: string; count: number; unique: number }>;
  locales: Array<{ value: string; count: number; unique: number }>;
  daily: Array<{ date: string; placeViews: number; saves: number; directions: number; couponClaims: number; couponRedemptions: number }>;
  coupons: Array<{ couponId: string; impressions: number; views: number; claims: number; redemptions: number; claimRate: number | null; redemptionRate: number | null }>;
};

export function aggregateBusinessPerformance(rows: BusinessPerformanceRpcRow[]): BusinessPerformance {
  const metric = (name: string): BusinessMetricValue => {
    const row = rows.find((item) => item.row_kind === "metric" && item.event_name === name);
    return { count: number(row?.event_count), unique: number(row?.unique_visitors) };
  };
  const placeViews = metric("place_view");
  const saves = metric("place_save");
  const directions = metric("directions_click");
  const phoneClicks = metric("phone_click");
  const couponViews = metric("coupon_view");
  const couponClaims = metric("coupon_claim");
  const couponRedemptions = metric("coupon_redeem");
  const impressionRow = rows.find((item) => item.row_kind === "coupon_stage" && item.dimension_value === "impression");
  const detailRow = rows.find((item) => item.row_kind === "coupon_stage" && item.dimension_value === "detail");
  const couponImpressions = { count: number(impressionRow?.event_count), unique: number(impressionRow?.unique_visitors) };
  const detailedCouponViews = detailRow ? { count: number(detailRow.event_count), unique: number(detailRow.unique_visitors) } : couponViews;
  const dates = new Map<string, BusinessPerformance["daily"][number]>();
  for (const row of rows.filter((item) => item.row_kind === "daily" && item.stat_date)) {
    const date = String(row.stat_date);
    const item = dates.get(date) ?? { date, placeViews: 0, saves: 0, directions: 0, couponClaims: 0, couponRedemptions: 0 };
    const count = number(row.event_count);
    if (row.event_name === "place_view") item.placeViews += count;
    if (row.event_name === "place_save") item.saves += count;
    if (row.event_name === "directions_click") item.directions += count;
    if (row.event_name === "coupon_claim") item.couponClaims += count;
    if (row.event_name === "coupon_redeem") item.couponRedemptions += count;
    dates.set(date, item);
  }
  const coupons = new Map<string, BusinessPerformance["coupons"][number]>();
  for (const row of rows.filter((item) => item.row_kind === "coupon" && item.dimension_value !== "unknown")) {
    const item = coupons.get(row.dimension_value) ?? { couponId: row.dimension_value, impressions: 0, views: 0, claims: 0, redemptions: 0, claimRate: null, redemptionRate: null };
    const count = number(row.event_count);
    if (row.event_name === "coupon_view") item.views += count;
    if (row.event_name === "coupon_claim") item.claims += count;
    if (row.event_name === "coupon_redeem") item.redemptions += count;
    coupons.set(item.couponId, item);
  }
  for (const item of coupons.values()) {
    item.claimRate = rate(item.claims, item.views);
    item.redemptionRate = rate(item.redemptions, item.claims);
  }
  return {
    metrics: {
      placeViews, saves, directions, phoneClicks, couponImpressions, couponViews: detailedCouponViews, couponClaims, couponRedemptions,
      saveConversionRate: rate(saves.count, placeViews.count),
      couponClaimRate: rate(couponClaims.count, detailedCouponViews.count),
      couponRedemptionRate: rate(couponRedemptions.count, couponClaims.count),
    },
    channels: dimensions(rows, "channel"),
    locales: dimensions(rows, "locale"),
    daily: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)),
    coupons: [...coupons.values()].sort((a, b) => b.redemptions - a.redemptions || b.claims - a.claims),
  };
}

export function performanceChanges(current: BusinessPerformance, previous: BusinessPerformance) {
  const keys = ["placeViews", "saves", "directions", "phoneClicks", "couponViews", "couponClaims", "couponRedemptions"] as const;
  return Object.fromEntries(keys.map((key) => [key, change(current.metrics[key].count, previous.metrics[key].count)]));
}

export function businessRecommendations(report: BusinessPerformance): string[] {
  const suggestions: string[] = [];
  const metrics = report.metrics;
  if (!metrics.placeViews.count) return ["선택한 기간에 분석할 장소 조회 데이터가 없습니다."];
  if (metrics.saveConversionRate !== null && metrics.saveConversionRate < 3) suggestions.push("조회 대비 저장 전환이 3% 미만입니다. 대표 사진과 방문 판단 정보를 점검하세요.");
  if (metrics.directions.count === 0) suggestions.push("길찾기 클릭이 없습니다. 주소와 지도 버튼이 정확히 노출되는지 확인하세요.");
  if (metrics.couponViews.count > 0 && metrics.couponClaimRate !== null && metrics.couponClaimRate < 10) suggestions.push("쿠폰 상세 확인 대비 발급률이 10% 미만입니다. 혜택과 사용 조건을 더 명확하게 설명하세요.");
  if (metrics.couponClaims.count > 0 && metrics.couponRedemptionRate !== null && metrics.couponRedemptionRate < 10) suggestions.push("발급 대비 사용률이 10% 미만입니다. 유효기간과 매장 사용 안내를 점검하세요.");
  if (!suggestions.length) suggestions.push("현재 표본에서는 규칙 기반 개선 경고가 발견되지 않았습니다. 기간을 늘려 추이를 함께 확인하세요.");
  return suggestions;
}

function dimensions(rows: BusinessPerformanceRpcRow[], kind: "channel" | "locale") {
  return rows.filter((item) => item.row_kind === kind).map((item) => ({ value: item.dimension_value, count: number(item.event_count), unique: number(item.unique_visitors) })).sort((a, b) => b.count - a.count);
}
function number(value: unknown) { const result = Number(value || 0); return Number.isFinite(result) ? result : 0; }
function rate(numerator: number, denominator: number) { return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null; }
function change(current: number, previous: number) { return previous > 0 ? Math.round(((current - previous) / previous) * 10_000) / 100 : null; }
