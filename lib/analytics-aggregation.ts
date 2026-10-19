import "server-only";

export type AnalyticsEventRow = {
  id: string;
  user_id: string | null;
  place_id: string | null;
  locale: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  occurred_at?: string | null;
  anonymous_session_id?: string | null;
  device_type?: string | null;
  channel?: string | null;
  source?: string | null;
};

export type DailyAnalyticsRow = {
  stat_date: string; place_id?: string | null; event_name: string; locale: string;
  device_type: string; channel: string; source: string; campaign_id: string;
  event_count: number | string; unique_visitors: number | string; updated_at: string;
};

export function aggregateGrowthEvents(rows: AnalyticsEventRow[]) {
  const metricTypes: Record<string, string[]> = {
    pageViews: ["page_view", "home_view"],
    placeViews: ["place_view", "place_opened"],
    impressions: ["place_impression"],
    saves: ["place_save", "place_saved"],
    unsaves: ["place_unsave"],
    photoClicks: ["photo_click"],
    menuClicks: ["menu_click", "menu_view"],
    mapClicks: ["map_click"],
    directions: ["directions_click", "map_opened"],
    phoneClicks: ["phone_click"],
    websiteClicks: ["website_click"],
    couponViews: ["coupon_view"],
    couponIssues: ["coupon_claim", "coupon_issued"],
    couponRedemptions: ["coupon_redeem", "coupon_redeemed"],
    searches: ["search", "place_search"],
    filters: ["filter_apply", "filter_applied"],
    courseSaves: ["course_save", "route_saved", "ai_route_saved"],
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
  const channels = countBy(rows, (row) => row.channel || metadataText(row, "channel") || inferLegacyChannel(row) || "unknown");
  const locales = countBy(rows, (row) => row.locale || "unknown");
  const devices = countBy(rows, (row) => row.device_type || "unknown");
  const sources = countBy(rows, (row) => row.source || metadataText(row, "initial_source") || "unknown");
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
      uniquePlaceViews: uniqueEventVisitors(rows, metricTypes.placeViews),
      saveConversionRate: rate(metrics.saves, metrics.placeViews),
      directionsClickRate: rate(metrics.directions, metrics.placeViews),
      locationSuccessRate: rate(metrics.locationSuccesses, metrics.locationRequests),
      importApplyRate: rate(metrics.importApplied, metrics.importSearches),
    },
    channels,
    locales,
    devices,
    sources,
    daily,
    popularPlaces,
    campaigns,
  };
}

export function aggregateDailyGrowthStats(rows: DailyAnalyticsRow[]) {
  const count = (types: string[]) => rows.filter((row) => types.includes(row.event_name)).reduce((sum, row) => sum + Number(row.event_count || 0), 0);
  const placeViews = count(["place_view", "place_opened"]);
  const saves = count(["place_save", "place_saved"]);
  const metrics = {
    pageViews: count(["page_view", "home_view"]), impressions: count(["place_impression"]), placeViews,
    uniquePlaceViews: rows.filter((row) => row.event_name === "__place_view_unique__").reduce((sum, row) => sum + Number(row.unique_visitors || 0), 0),
    saves, unsaves: count(["place_unsave"]), photoClicks: count(["photo_click"]), menuClicks: count(["menu_click", "menu_view"]),
    mapClicks: count(["map_click"]), directions: count(["directions_click", "map_opened"]), phoneClicks: count(["phone_click"]),
    websiteClicks: count(["website_click"]), couponViews: count(["coupon_view"]), couponIssues: count(["coupon_claim", "coupon_issued"]),
    couponRedemptions: count(["coupon_redeem", "coupon_redeemed"]), searches: count(["search", "place_search"]),
    filters: count(["filter_apply", "filter_applied"]), courseSaves: count(["course_save", "route_saved", "ai_route_saved"]),
    saveConversionRate: rate(saves, placeViews), directionsClickRate: rate(count(["directions_click", "map_opened"]), placeViews),
  };
  const detailRows = rows.filter((row) => !row.event_name.startsWith("__"));
  const dimensions = (key: "channel" | "locale" | "device_type" | "source") => Object.entries(detailRows.reduce<Record<string, { count: number; visitors: number }>>((all, row) => {
    const value = row[key] || "unknown"; const item = all[value] ??= { count: 0, visitors: 0 };
    item.count += Number(row.event_count || 0); item.visitors += Number(row.unique_visitors || 0); return all;
  }, {})).map(([value, item]) => ({ value, ...item })).sort((a, b) => b.count - a.count);
  const daily = Object.entries(rows.reduce<Record<string, DailyAnalyticsRow[]>>((all, row) => { (all[row.stat_date] ??= []).push(row); return all; }, {}))
    .sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => ({ date, events: items.filter((row) => !row.event_name.startsWith("__")).reduce((sum, row) => sum + Number(row.event_count || 0), 0), visitors: Number(items.find((row) => row.event_name === "__all__")?.unique_visitors || 0), placeViews: items.filter((row) => ["place_view", "place_opened"].includes(row.event_name)).reduce((sum, row) => sum + Number(row.event_count || 0), 0), directions: items.filter((row) => ["directions_click", "map_opened"].includes(row.event_name)).reduce((sum, row) => sum + Number(row.event_count || 0), 0), couponRedemptions: items.filter((row) => ["coupon_redeem", "coupon_redeemed"].includes(row.event_name)).reduce((sum, row) => sum + Number(row.event_count || 0), 0) }));
  const places = rows.filter((row) => row.place_id).reduce<Record<string, DailyAnalyticsRow[]>>((all, row) => { (all[row.place_id!] ??= []).push(row); return all; }, {});
  const popularPlaces = Object.entries(places).map(([placeId, items]) => ({ placeId, views: sumDaily(items, ["place_view", "place_opened"]), saves: sumDaily(items, ["place_save", "place_saved"]), directions: sumDaily(items, ["directions_click", "map_opened"]), couponRedemptions: sumDaily(items, ["coupon_redeem", "coupon_redeemed"]) })).sort((a, b) => b.views - a.views).slice(0, 20);
  return { visitors: null, totalEvents: detailRows.reduce((sum, row) => sum + Number(row.event_count || 0), 0), metrics, channels: dimensions("channel"), locales: dimensions("locale"), devices: dimensions("device_type"), sources: dimensions("source"), daily, popularPlaces, campaigns: [], aggregateUpdatedAt: rows.map((row) => row.updated_at).sort().at(-1) ?? null };
}

export function aggregateDailyPlaceRankings(rows: DailyAnalyticsRow[]) {
  const places = rows.filter((row) => row.place_id).reduce<Record<string, DailyAnalyticsRow[]>>((all, row) => { (all[row.place_id!] ??= []).push(row); return all; }, {});
  return Object.entries(places).map(([placeId, items]) => ({ placeId, views: sumDaily(items, ["place_view", "place_opened"]), saves: sumDaily(items, ["place_save", "place_saved"]), directions: sumDaily(items, ["directions_click", "map_opened"]), couponRedemptions: sumDaily(items, ["coupon_redeem", "coupon_redeemed"]) })).sort((a, b) => b.views - a.views).slice(0, 20);
}

function countTypes(rows: AnalyticsEventRow[], types: string[]) {
  const set = new Set(types);
  return rows.filter((row) => set.has(row.event_type)).length;
}

function visitorKey(row: AnalyticsEventRow) {
  return row.user_id ? `user:${row.user_id}` : row.anonymous_session_id || metadataText(row, "visit_id") || "";
}

function uniqueEventVisitors(rows: AnalyticsEventRow[], types: string[]) {
  const allowed = new Set(types);
  return new Set(rows.filter((row) => allowed.has(row.event_type)).map(visitorKey).filter(Boolean)).size;
}

function sumDaily(rows: DailyAnalyticsRow[], types: string[]) { return rows.filter((row) => types.includes(row.event_name)).reduce((sum, row) => sum + Number(row.event_count || 0), 0); }

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
