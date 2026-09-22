import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function load(request, mocks = {}) {
  if (request in mocks) return mocks[request];
  const filename = path.resolve(request.replace(/^@\//, "") + ".ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (next) => load(next, mocks), URL, Date, Request, Response, crypto }, { filename });
  return module.exports;
}

const { createEmptyTravelerDecisionBundle, validateTravelerDecisionSection } = load("@/lib/traveler-decision-validation", {
  "@/types/traveler-decision": { travelerThemes: ["first_trip", "solo", "couple", "parents", "rainy_day", "food_trip", "photo_trip", "cafe_trip", "night_view", "low_walking", "luggage_day", "late_night"] },
});
const empty = createEmptyTravelerDecisionBundle();

assert.equal(empty.practical.foreign_card, "unknown", "Unverified facts must not default to false");
assert.equal(empty.decision.tourist_fit_score, null, "Scores must remain null without evidence");
assert.throws(() => validateTravelerDecisionSection("decision", { ...empty.decision, tourist_fit_score: 80, confidence_score: 90 }), /근거/);
assert.throws(() => validateTravelerDecisionSection("decision", { ...empty.decision, evidence_count: 1, tourist_fit_score: 80 }), /신뢰도/);
assert.throws(() => validateTravelerDecisionSection("decision", { ...empty.decision, verification_status: "verified" }), /확인일/);
assert.equal(validateTravelerDecisionSection("decision", { ...empty.decision, evidence_count: 1, tourist_fit_score: 80, confidence_score: 90, verification_status: "verified", last_verified_at: "2026-09-22T03:00:00Z" }).tourist_fit_score, 80);

assert.throws(() => validateTravelerDecisionSection("practical", { ...empty.practical, kiosk_language_support: { status: "no", languages: ["zh"] } }), /언어 목록/);
assert.equal(validateTravelerDecisionSection("practical", empty.practical).wheelchair_access, "unknown");

const hours = { ...empty.operating, structured_operating_hours: [{ weekday: 1, open: "10:00", close: "18:00", closed: false }], last_order_time: "19:00" };
assert.throws(() => validateTravelerDecisionSection("operating", hours), /라스트오더/);
assert.throws(() => validateTravelerDecisionSection("operating", { ...empty.operating, recommended_time_ranges: [{ weekdays: [1], start: "18:00", end: "10:00" }] }), /종료시간/);
assert.throws(() => validateTravelerDecisionSection("operating", { ...empty.operating, recommended_time_ranges: [{ weekdays: [1], start: "10:00", end: "12:00" }], avoid_time_ranges: [{ weekdays: [1], start: "11:00", end: "13:00" }] }), /서로 겹칩니다/);
assert.equal(validateTravelerDecisionSection("operating", { ...empty.operating, structured_operating_hours: [{ weekday: 5, open: "18:00", close: "02:00", closed: false, overnight: true }], last_order_time: "01:00" }).last_order_time, "01:00");

const menu = { localized_name: { ko: "돼지국밥", zh: "猪肉汤饭", en: "Pork soup", ja: "テジクッパ" }, korean_original_name: "돼지국밥", price: 10000, recommendation_status: "yes", recommendation_basis: "", spicy_level: null, oily_level: null, aroma_level: null, portion_size: null, recommended_party_size: null, ordering_note: { ko: "", zh: "", en: "", ja: "" }, menu_warning: { ko: "", zh: "", en: "", ja: "" }, availability_time: [], sold_out_risk: null, sort_order: 0 };
assert.throws(() => validateTravelerDecisionSection("menus", [menu]), /추천 근거/);
assert.equal(validateTravelerDecisionSection("menus", [{ ...menu, recommendation_basis: "운영자 시식 및 공식 메뉴 확인" }])[0].recommendation_status, "yes");

const evidence = { field_key: "foreign_card", fact_value: "yes", source_type: "unverified", source_label: "", source_url: "", observed_at: null, verified_at: null, verification_status: "verified", notes: "" };
assert.throws(() => validateTravelerDecisionSection("evidence", [evidence]), /출처 종류와 관찰일/);
assert.throws(() => validateTravelerDecisionSection("connections", [{ to_place_id: "not-a-uuid", travel_minutes: null, travel_distance: null, travel_mode: null, sequence_reason: { ko: "", zh: "", en: "", ja: "" }, valid_time_ranges: [], weather_conditions: [], trip_theme: [], active: true, priority: 0 }]), /연결 장소/);

const migration = fs.readFileSync("supabase/migrations/030_traveler_decision_data.sql", "utf8");
for (const table of ["place_decision_profiles", "place_operating_profiles", "place_fact_evidence", "place_connections", "place_checkins", "place_fact_reports", "place_fact_votes", "place_report_evidence", "user_trust_profiles", "sns_place_mappings", "sns_place_candidates"]) {
  assert.match(migration, new RegExp(`create table public\\.${table}`), `${table} must be created`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must enable RLS`);
}
assert.match(migration, /source_url_hash text not null/);
assert.doesNotMatch(migration, /create table public\.sns_place_mappings[\s\S]*?source_url text/i, "Raw SNS URLs must not be stored");
assert.doesNotMatch(migration, /grant .*place_fact_reports.* to anon/i, "Raw traveler reports must not be granted to anonymous users");
assert.match(migration, /user_id = auth\.uid\(\)/);
assert.match(migration, /public\.is_admin\(\)/);
assert.match(migration, /recommendation_status <> 'yes' or length/);
assert.match(migration, /timezone = 'Asia\/Seoul'/);

for (const status of [401, 403]) {
  let checks = 0;
  const route = load("@/app/api/admin/places/[id]/traveler-decision/route", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/admin-auth": {
      requireAdmin: async () => { checks += 1; throw Object.assign(new Error("Denied"), { status }); },
      adminErrorResponse: (error) => ({ message: error.message, status: error.status }),
    },
    "@/lib/traveler-decision-validation": { createEmptyTravelerDecisionBundle, validateTravelerDecisionSection },
  });
  for (const handler of [route.GET, route.PUT]) {
    const response = await handler(new Request("http://localhost/api/admin/places/11111111-1111-4111-8111-111111111111/traveler-decision"), { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    assert.equal(response.status, status);
  }
  assert.equal(checks, 2);
}

const routeSource = fs.readFileSync("app/api/admin/places/[id]/traveler-decision/route.ts", "utf8");
assert.match(routeSource, /count: "exact", head: true/);
assert.match(routeSource, /\.in\("verification_status", \["verified", "partially_verified"\]\)/);

process.stdout.write("Traveler decision validation, unknown-state defaults, provenance, RLS and privacy tests passed.\n");
