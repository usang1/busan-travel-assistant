import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function load(path, sharp) { const { outputText } = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }); const module = { exports: {} }; new Script(outputText).runInNewContext({ module, exports: module.exports, require: (name) => name === "server-only" ? {} : name === "sharp" ? sharp : (() => { throw new Error(`Unexpected import ${name}`); })(), Date, Math, Object, Array, Set, Map, Number, String, Buffer, Intl }); return module.exports; }

const performance = load("lib/business-performance.ts");
const rows = [
  { row_kind: "metric", event_name: "place_view", dimension: "all", dimension_value: "all", stat_date: null, event_count: 100, unique_visitors: 80 },
  { row_kind: "metric", event_name: "place_save", dimension: "all", dimension_value: "all", stat_date: null, event_count: 10, unique_visitors: 9 },
  { row_kind: "metric", event_name: "coupon_claim", dimension: "all", dimension_value: "all", stat_date: null, event_count: 4, unique_visitors: 4 },
  { row_kind: "metric", event_name: "coupon_redeem", dimension: "all", dimension_value: "all", stat_date: null, event_count: 2, unique_visitors: 2 },
  { row_kind: "coupon_stage", event_name: "coupon_view", dimension: "stage", dimension_value: "detail", stat_date: null, event_count: 20, unique_visitors: 15 },
  { row_kind: "daily", event_name: "place_view", dimension: "date", dimension_value: "2026-10-19", stat_date: "2026-10-19", event_count: 100, unique_visitors: 80 },
  { row_kind: "channel", event_name: "place_view", dimension: "channel", dimension_value: "hotel_qr", stat_date: null, event_count: 25, unique_visitors: 20 },
];
const report = performance.aggregateBusinessPerformance(rows);
assert.equal(report.metrics.placeViews.unique, 80);
assert.equal(report.metrics.saveConversionRate, 10);
assert.equal(report.metrics.couponClaimRate, 20);
assert.equal(report.metrics.couponRedemptionRate, 50);
assert.equal(report.channels[0].value, "hotel_qr");
assert.equal(performance.performanceChanges(report, performance.aggregateBusinessPerformance([])).placeViews, null);
assert.ok(performance.businessRecommendations(report).length > 0);

const entitlements = load("lib/business-entitlements.ts");
assert.equal(entitlements.resolveBusinessEntitlement([], "p1").planCode, "free");
assert.equal(entitlements.resolveBusinessEntitlement([], "p1").features.report_download, false);
const pro = entitlements.resolveBusinessEntitlement([{ status: "trial", starts_at: "2026-10-01", ends_at: "2026-12-01", place_id: "p1", subscription_plans: { code: "pro", name: "Pro", features: {} } }], "p1", new Date("2026-10-19"));
assert.equal(pro.status, "trial"); assert.equal(pro.features.period_comparison, true);

const migration = read("supabase/migrations/055_business_reports_and_coupon_operations.sql");
for (const table of ["coupon_redemption_events", "business_performance_reports"]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
assert.match(migration, /revoke execute on function public\.issue_coupon\(uuid, text\) from public, anon/);
assert.match(migration, /where id = target_coupon_id for update/);
assert.match(migration, /where public_token = issue_token for update/);
assert.match(migration, /coupon_redemption_limit_reached/);
assert.match(migration, /Entitled owners read place reports/);
assert.match(migration, /get_business_place_performance/);

const couponApi = read("app/api/business/coupons/route.ts");
assert.match(couponApi, /business_place_memberships/); assert.match(couponApi, /per_user_redemption_limit/); assert.match(couponApi, /discount_type/);
assert.match(read("app/api/coupons/route.ts"), /if \(!token\).*status: 401/s);
assert.match(read("app/api/admin/business-reports/route.ts"), /businessRecommendations/);
const dashboard = read("components/BusinessPerformanceDashboard.tsx");
for (const value of ["[7, 30, 90]", "고유 조회자", "방문 의향 지표", "report_download", "coupon_analytics"]) assert.ok(dashboard.includes(value));
const traveler = read("components/MyCoupons.tsx");
assert.match(traveler, /public_token/); for (const locale of ["ko:", "zh:", "en:", "ja:"]) assert.ok(traveler.includes(locale));

const sharp = (await import("sharp")).default;
const pdfModule = load("lib/business-report-pdf.ts", sharp);
const pdf = await pdfModule.renderBusinessReportPdf({ place: { name: "Spotzari Test" }, period: { from: "2026-10-01", to: "2026-10-31" }, current: report, previous: null, changes: null, limitations: ["Test limitation"] }, ["Test recommendation"], "2026-10-19");
assert.equal(pdf.subarray(0, 4).toString(), "%PDF"); assert.match(pdf.subarray(-30).toString(), /%%EOF/);

console.log("Business performance and coupon tests passed: aggregation, entitlements, snapshots/PDF, login-only claims, row locks, limits, RLS, audit history, and four-locale UX.");
