import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

function read(path) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
function loadSchema() {
  const { outputText } = ts.transpileModule(read("lib/analytics-schema.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Script(outputText).runInNewContext({ module, exports: module.exports, require: (specifier) => { throw new Error(`Unexpected import: ${specifier}`); }, Set, Object, Array, Number, String });
  return module.exports;
}

function loadAggregation() {
  const { outputText } = ts.transpileModule(read("lib/analytics-aggregation.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  new Script(outputText).runInNewContext({ module, exports: module.exports, require: (specifier) => specifier === "server-only" ? {} : (() => { throw new Error(`Unexpected import: ${specifier}`); })(), Set, Object, Array, Number, String, Date, Intl });
  return module.exports;
}

const schema = loadSchema();
for (const name of ["page_view", "place_impression", "place_view", "place_save", "place_unsave", "photo_click", "menu_click", "map_click", "directions_click", "phone_click", "website_click", "coupon_view", "coupon_claim", "coupon_redeem", "search", "filter_apply", "course_save"]) assert.equal(schema.isAnalyticsEventName(name), true, `${name} must be accepted`);
assert.equal(schema.canonicalEventName("place_opened"), "place_view");
assert.equal(schema.canonicalEventName("coupon_issued"), "coupon_claim");
assert.equal(schema.legacyCompatibleEventName("menu_click"), "menu_view");
assert.equal(schema.analyticsDedupeWindowSeconds("place_view"), 1800);
assert.equal(schema.analyticsDedupeWindowSeconds("phone_click"), 5);
assert.equal(schema.analyticsDeviceType(undefined, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile"), "mobile");
assert.equal(schema.analyticsDeviceType(undefined, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140"), "desktop");
assert.equal(schema.analyticsDeviceType(undefined, "Mozilla/5.0 (iPad; CPU OS 18_0)"), "tablet");
const sanitized = schema.sanitizeAnalyticsMetadata({ category: "cafe", phone: "010-1234", access_token: "secret", latitude: 35.1, result_count: 4 });
assert.deepEqual(Object.keys(sanitized).sort(), ["category", "result_count"]);

const aggregation = loadAggregation();
const rawReport = aggregation.aggregateGrowthEvents([
  { id: "1", user_id: null, place_id: "p1", locale: "ko", event_type: "place_view", anonymous_session_id: "s1", device_type: "mobile", channel: "direct", source: "direct", metadata: {}, created_at: "2026-10-19T00:00:00Z" },
  { id: "2", user_id: null, place_id: "p1", locale: "ko", event_type: "place_view", anonymous_session_id: "s1", device_type: "mobile", channel: "direct", source: "direct", metadata: {}, created_at: "2026-10-19T00:01:00Z" },
  { id: "3", user_id: "u1", place_id: "p1", locale: "en", event_type: "directions_click", anonymous_session_id: "s2", device_type: "desktop", channel: "google_search", source: "google", metadata: {}, created_at: "2026-10-19T00:02:00Z" },
]);
assert.equal(rawReport.metrics.placeViews, 2);
assert.equal(rawReport.metrics.uniquePlaceViews, 1);
assert.equal(rawReport.visitors, 2);
assert.equal(rawReport.devices.find((item) => item.value === "mobile").count, 2);

const dailyReport = aggregation.aggregateDailyGrowthStats([
  { stat_date: "2026-10-19", event_name: "place_view", locale: "ko", device_type: "mobile", channel: "direct", source: "direct", campaign_id: "", event_count: 5, unique_visitors: 3, updated_at: "2026-10-19T01:00:00Z" },
  { stat_date: "2026-10-19", event_name: "__all__", locale: "all", device_type: "all", channel: "all", source: "all", campaign_id: "", event_count: 10, unique_visitors: 4, updated_at: "2026-10-19T01:00:00Z" },
  { stat_date: "2026-10-19", event_name: "__place_view_unique__", locale: "all", device_type: "all", channel: "all", source: "all", campaign_id: "", event_count: 5, unique_visitors: 3, updated_at: "2026-10-19T01:00:00Z" },
]);
assert.equal(dailyReport.daily[0].visitors, 4);
assert.equal(dailyReport.totalEvents, 5);
assert.equal(dailyReport.metrics.uniquePlaceViews, 3);

const route = read("app/api/analytics/events/route.ts");
assert.match(route, /createServerServiceClient/);
assert.match(route, /looksLikeBot/);
assert.match(route, /enforceRateLimit/);
assert.match(route, /ignoreDuplicates: true/);
assert.doesNotMatch(route, /request\.headers\.get\(["']x-forwarded-for/);

const migration = read("supabase/migrations/054_analytics_event_pipeline.sql");
for (const table of ["analytics_daily_place_stats", "analytics_daily_platform_stats"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
assert.match(migration, /place_action_events_dedupe_uidx/);
assert.match(migration, /refresh_analytics_daily_stats/);
assert.match(migration, /purge_expired_analytics_events/);
assert.match(migration, /Owners read own daily place analytics/);
assert.match(migration, /drop policy if exists "Anyone can create place action events"/);

const productAnalytics = read("components/ProductAnalytics.tsx");
assert.match(productAnalytics, /IntersectionObserver/);
assert.match(productAnalytics, /intersectionRatio >= 0\.4/);
const directions = read("components/DirectionsButton.tsx");
assert.match(directions, /eventType: "map_click"/);
assert.match(directions, /eventType: "directions_click"/);
const dashboard = read("components/AdminGrowthAnalytics.tsx");
assert.match(dashboard, /CSV/);
assert.match(dashboard, /저장 전환율/);
assert.match(dashboard, /지표 정의와 한계/);

console.log("Analytics infrastructure tests passed: schema validation, PII minimization, dedupe windows, ingestion controls, aggregates, RLS, retention, impressions, funnels, and CSV.");
