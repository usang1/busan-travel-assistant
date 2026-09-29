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
assert.equal(verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [{ fact_type: "solo_friendly", fact_value: true }] }).facts.length, 1, "A partial one-chip submission must be valid");
const explicitUnavailable = verification.parseTravelerVerificationPayload({
  placeId,
  locale: "ko",
  facts: [{ fact_type: "foreign_card", fact_value: false }, { fact_type: "restroom_needs_check", fact_value: true }],
});
assert.equal(explicitUnavailable.facts[0].fact_value, false, "Explicit false must remain distinct from an unknown/missing fact");
assert.equal(explicitUnavailable.facts[1].fact_type, "restroom_needs_check");
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [] }));
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [
  { fact_type: "foreign_card", fact_value: true },
  { fact_type: "foreign_card", fact_value: false },
] }));
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: [{ fact_type: "waiting_minutes", fact_value: 25 }] }));
assert.throws(() => verification.parseTravelerVerificationPayload({ placeId, locale: "ko", facts: Array.from({ length: 9 }, (_, index) => ({ fact_type: `unknown_${index}`, fact_value: true })) }));

const migration = read("../supabase/migrations/033_traveler_verification_and_trust_signals.sql");
const signalsMigration = read("../supabase/migrations/037_lightweight_place_verification_signals.sql");
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
assert.match(signalsMigration, /restroom_needs_check/);
assert.match(signalsMigration, /else 'reported'/);
assert.match(signalsMigration, /get_place_trust_summaries/);
assert.match(signalsMigration, /merge_traveler_reports/);
assert.match(signalsMigration, /where id = target_place_id and is_active and status in \('PUBLISHED', 'ACTIVE'\)/);
assert.match(signalsMigration, /moderation_status = 'approved'/);
assert.match(signalsMigration, /interval '1 day'/);
assert.match(signalsMigration, /interval '90 days'/);

const noEvidenceSignal = verification.getTravelerCardTrustSignal(verification.emptyTravelerTrustSummary(), "ko");
assert.equal(noEvidenceSignal.text, "최근 정보 부족");
const unavailableCardSignal = verification.getTravelerCardTrustSignal({
  ...verification.emptyTravelerTrustSummary(),
  facts: [{ fact_type: "foreign_card", latest_value: false, latest_observed_at: "2026-09-29T00:00:00Z", report_count: 1, recent_count: 1, verification_status: "reported" }],
}, "ko");
assert.equal(unavailableCardSignal.text, "해외카드 불가 확인");

const route = read("../app/api/traveler-verifications/route.ts");
assert.match(route, /httpOnly: true/);
assert.match(route, /sameSite: "lax"/);
assert.match(route, /createHmac\("sha256"/);
assert.match(route, /isSameOrigin/);
assert.doesNotMatch(route, /x-forwarded-for|cf-connecting-ip|request\.ip/);
assert.match(route, /get_place_trust_summaries/);
assert.match(route, /slice\(0, 50\)/);

const component = read("../components/TravelerVerification.tsx");
assert.match(component, /정확한 위치는 서버에 보내거나 저장하지 않습니다/);
assert.match(component, /body: JSON\.stringify\(\{ placeId, locale, nearbyConfirmed, facts: selected \}\)/);
assert.match(component, /options\.filter\(\(item\) => showMore \|\| !item\.secondary\)/);
assert.match(component, /rememberTravelerVisit/);
for (const label of ["해외카드 불가", "중국어 메뉴 없음", "혼자 방문 불편", "화장실 확인 필요"]) assert.match(component, new RegExp(label));
assert.match(component, /flex flex-wrap gap-2/);

const adminRoute = read("../app/api/admin/traveler-reports/route.ts");
assert.match(adminRoute, /actor_type/);
assert.doesNotMatch(adminRoute, /select\("\*"\)/);
const adminUi = read("../components/AdminTravelerReportWorkflow.tsx");
assert.match(adminUi, /상충 우선/);
assert.match(adminUi, /신고·개인정보 우선/);
assert.match(adminUi, /오래된 정보/);
assert.match(adminUi, /같은 값 병합 승인/);
assert.match(adminUi, /정식 장소 필드를 자동으로 덮어쓰지 않으며/);

const localizedDetail = read("../app/[locale]/places/[slug]/page.tsx");
const reportPage = read("../components/PlaceCorrectionPageView.tsx");
const savedPage = read("../components/SavedItemsView.tsx");
assert.match(localizedDetail, /<TravelerVerification/);
assert.match(localizedDetail, /<TravelerTrustSignals/);
assert.match(reportPage, /<TravelerVerification/);
assert.match(savedPage, /<TravelerVerification/);
const placeCard = read("../components/PlaceCard.tsx");
assert.match(placeCard, /<TravelerTrustSummaryBadge/);
assert.doesNotMatch(placeCard, /댓글|장문 리뷰|별점 리뷰/);

console.log("Traveler verification validation, privacy boundaries, trust decay, moderation, and UI integration tests passed.");
