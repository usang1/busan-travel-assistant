import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function compile(path) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, () => ({}));
  return module.exports;
}

const verification = compile("../lib/traveler-verification.ts");
const placeId = "a1b2c3d4-1111-4222-8333-123456789abc";
const valid = verification.parseTravelerVerificationPayload({
  placeId,
  locale: "zh",
  nearbyConfirmed: true,
  facts: [{ fact_type: "waiting_minutes", fact_value: 40 }, { fact_type: "foreign_card", fact_value: true }],
});
assert.equal(valid.facts.length, 2);
assert.equal(valid.nearbyConfirmed, true);
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [] }));
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [
  { fact_type: "foreign_card", fact_value: true },
  { fact_type: "foreign_card", fact_value: false },
] }));
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [{ fact_type: "waiting_minutes", fact_value: 25 }] }));
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: Array.from({ length: 9 }, (_, index) => ({ fact_type: `unknown_${index}`, fact_value: true })) }));

const migration = read("../supabase/migrations/033_traveler_verification_and_trust_signals.sql");
assert.match(migration, /submit_traveler_verification/);
assert.match(migration, /grant execute on function public\.submit_traveler_verification[\s\S]+to service_role/);
assert.match(migration, /revoke all on function public\.submit_traveler_verification[\s\S]+from public, anon, authenticated/);
assert.match(migration, /created_at > now\(\) - interval '6 hours'/);
assert.match(migration, /recent_count >= 3/);
assert.match(migration, /recent_count >= 10/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /rapid_multi_place_submission/);
assert.match(migration, /get_place_trust_summary/);
assert.match(migration, /verification_status = 'conflicting'/);
assert.match(migration, /verification_status = 'stale'/);
assert.match(migration, /evidence_weight >= 3\.000/);
assert.match(migration, /privacy_status/);

const route = read("../app/api/traveler-verifications/route.ts");
assert.match(route, /httpOnly: true/);
assert.match(route, /sameSite: "lax"/);
assert.match(route, /createHmac\("sha256"/);
assert.match(route, /isSameOrigin/);
assert.doesNotMatch(route, /x-forwarded-for|cf-connecting-ip|request\.ip/);

const component = read("../components/TravelerVerification.tsx");
assert.match(component, /정확한 위치는 서버에 보내거나 저장하지 않습니다/);
assert.match(component, /body: JSON\.stringify\(\{ placeId, locale, nearbyConfirmed, facts: selected \}\)/);
assert.match(component, /options\.filter\(\(item\) => showMore \|\| !item\.secondary\)/);
assert.match(component, /rememberTravelerVisit/);

const adminRoute = read("../app/api/admin/traveler-reports/route.ts");
assert.match(adminRoute, /actor_type/);
assert.doesNotMatch(adminRoute, /select\("\*"\)/);
const adminUi = read("../components/AdminTravelerReportWorkflow.tsx");
assert.match(adminUi, /상충 우선/);
assert.match(adminUi, /신고·개인정보 우선/);
assert.match(adminUi, /정식 장소 필드를 자동으로 덮어쓰지 않으며/);

const localizedDetail = read("../app/[locale]/places/[slug]/page.tsx");
const reportPage = read("../components/PlaceCorrectionPageView.tsx");
const savedPage = read("../components/SavedItemsView.tsx");
assert.match(localizedDetail, /<TravelerVerification/);
assert.match(localizedDetail, /<TravelerTrustSignals/);
assert.match(reportPage, /<TravelerVerification/);
assert.match(savedPage, /<TravelerVerification/);

console.log("Traveler verification validation, privacy boundaries, trust decay, moderation, and UI integration tests passed.");
