import "server-only";

export type AnalyticsEventRow = {
  id: string;
  user_id: string | null;
  place_id: string | null;
  locale: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function aggregateGrowthEvents(rows: AnalyticsEventRow[]) {
  const metricTypes: Record<string, string[]> = {
    pageViews: ["page_view", "home_view"],
    placeViews: ["place_view", "place_opened"],
    saves: ["place_save", "place_saved"],
    directions: ["directions_click"],
    phoneClicks: ["phone_click"],
    couponIssues: ["coupon_issued"],
    couponRedemptions: ["coupon_redeemed"],
    stayQrLandings: ["stay_qr_landing"],
    importSearches: ["place_import_search"],
    importApplied: ["place_import_applied"],
    locationRequests: ["location_requested"],
    locationSuccesses: ["location_succeeded"],
    locationFailures: ["location_failed"],
    addressSearches: ["address_search"],
    coordinateSaveFailures: ["coordinate_save_failed"],
  };
  const metrics = Object.fromEntries(Object.entries(metricTypes).map(([key, types]) => [key, countTypes(rows, types)]));
  const visitors = new Set(rows.map(visitorKey).filter(Boolean)).size;
  const channels = countBy(rows, (row) => metadataText(row, "channel") || inferLegacyChannel(row) || "unknown");
  const locales = countBy(rows, (row) => row.locale || "unknown");
  const daily = Object.entries(groupBy(rows, (row) => seoulDate(row.created_at)))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      events: events.length,
      visitors: new Set(events.map(visitorKey).filter(Boolean)).size,
      placeViews: countTypes(events, metricTypes.placeViews),
      directions: countTypes(events, metricTypes.directions),
      couponRedemptions: countTypes(events, metricTypes.couponRedemptions),
    }));
  const popularPlaces = Object.entries(groupBy(rows.filter((row) => row.place_id && metricTypes.placeViews.includes(row.event_type)), (row) => row.place_id!))
    .map(([placeId, events]) => ({
      placeId,
      views: events.length,
      saves: rows.filter((row) => row.place_id === placeId && metricTypes.saves.includes(row.event_type)).length,
      directions: rows.filter((row) => row.place_id === placeId && metricTypes.directions.includes(row.event_type)).length,
      couponRedemptions: rows.filter((row) => row.place_id === placeId && metricTypes.couponRedemptions.includes(row.event_type)).length,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);
  const campaigns = Object.entries(groupBy(rows.filter((row) => metadataText(row, "campaign_id")), (row) => metadataText(row, "campaign_id")))
    .map(([campaignId, events]) => ({
      campaignId,
      visitors: new Set(events.map(visitorKey).filter(Boolean)).size,
      placeViews: countTypes(events, metricTypes.placeViews),
      directions: countTypes(events, metricTypes.directions),
      couponRedemptions: countTypes(events, metricTypes.couponRedemptions),
    }))
    .sort((a, b) => b.visitors - a.visitors);

  return {
    visitors,
    totalEvents: rows.length,
    metrics: {
      ...metrics,
      locationSuccessRate: rate(metrics.locationSuccesses, metrics.locationRequests),
      importApplyRate: rate(metrics.importApplied, metrics.importSearches),
    },
    channels,
    locales,
    daily,
    popularPlaces,
    campaigns,
  };
}

function countTypes(rows: AnalyticsEventRow[], types: string[]) {
  const set = new Set(types);
  return rows.filter((row) => set.has(row.event_type)).length;
}

function visitorKey(row: AnalyticsEventRow) {
  return metadataText(row, "visit_id") || (row.user_id ? `user:${row.user_id}` : "");
}

function metadataText(row: AnalyticsEventRow, key: string) {
  const value = row.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function inferLegacyChannel(row: AnalyticsEventRow) {
  const source = metadataText(row, "initial_source").toLowerCase();
  if (/xiaohongshu|rednote|xhs/u.test(source)) return "xiaohongshu";
  if (/instagram/u.test(source)) return "instagram";
  if (/naver/u.test(source)) return "naver_blog";
  if (/google/u.test(source)) return "google_search";
  if (source === "direct") return "direct";
  return source ? "other" : "";
}

function countBy(rows: AnalyticsEventRow[], key: (row: AnalyticsEventRow) => string) {
  return Object.entries(groupBy(rows, key))
    .map(([value, events]) => ({ value, count: events.length, visitors: new Set(events.map(visitorKey).filter(Boolean)).size }))
    .sort((a, b) => b.count - a.count);
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, T[]>>((groups, row) => {
    const value = key(row) || "unknown";
    (groups[value] ??= []).push(row);
    return groups;
  }, {});
}

function seoulDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null;
}
