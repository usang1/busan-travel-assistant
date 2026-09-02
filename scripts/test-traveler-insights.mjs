import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/traveler-insights.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const module = { exports: {} };

new Script(output, { filename: "lib/traveler-insights.ts" }).runInNewContext({
  module,
  exports: module.exports,
  require: (specifier) => { throw new Error(`Unexpected runtime import: ${specifier}`); },
  Date,
  Intl,
  Object,
});

const {
  createEmptyTravelerInsights,
  hasVisibleTravelerInsights,
  isPlaceInformationStale,
  normalizeTravelerInsights,
  travelerInsightsFromPlaceInfo,
  verificationDateLabel,
} = module.exports;

const empty = createEmptyTravelerInsights();
assert.equal(hasVisibleTravelerInsights(empty), false);

const normalized = normalizeTravelerInsights({
  card_payment: "yes",
  ordering_method: "kiosk",
  reservation: "invented",
  unknown_key: "ignored",
});
assert.equal(normalized.card_payment, "yes");
assert.equal(normalized.ordering_method, "kiosk");
assert.equal(normalized.reservation, "unknown");
assert.equal("unknown_key" in normalized, false);
assert.equal(hasVisibleTravelerInsights(normalized), true);

const legacy = travelerInsightsFromPlaceInfo({
  traveler_insights: { english_menu: "yes", solo_dining: "no" },
  solo_friendly: "yes",
  foreign_card: "yes",
  chinese_menu: "yes",
  luggage_friendly: "unknown",
  toilet_available: "yes",
  reservation_required: "no",
  waiting_level: "long",
  spicy_level: 5,
  greasy_level: 2,
  portion_level: 4,
  tourism_recommended: "yes",
});
assert.equal(legacy.solo_dining, "no", "explicit JSON must win over legacy data");
assert.equal(legacy.card_payment, "yes");
assert.equal(legacy.english_menu, "yes");
assert.equal(legacy.toilet, "available");
assert.equal(legacy.reservation, "not_needed");
assert.equal(legacy.waiting, "high");
assert.equal(legacy.spicy, "strong");
assert.equal(legacy.portion, "large");

const explicitlyCleared = travelerInsightsFromPlaceInfo({
  traveler_insights: { card_payment: "unknown" },
  solo_friendly: "unknown",
  foreign_card: "yes",
  chinese_menu: "unknown",
  luggage_friendly: "unknown",
  toilet_available: "unknown",
  reservation_required: "unknown",
  waiting_level: "unknown",
  spicy_level: null,
  greasy_level: null,
  portion_level: null,
  tourism_recommended: "unknown",
});
assert.equal(explicitlyCleared.card_payment, "unknown", "an explicit unknown must clear a legacy value");

assert.equal(isPlaceInformationStale("2026-01-01T00:00:00Z", new Date("2026-09-01T00:00:00Z")), true);
assert.equal(isPlaceInformationStale("2026-08-29T00:00:00Z", new Date("2026-09-01T00:00:00Z")), false);
assert.match(verificationDateLabel("2026-08-29T00:00:00Z", "ko"), /정보 확인/);

const migration = readFileSync(new URL("../supabase/migrations/016_traveler_insights_and_verification.sql", import.meta.url), "utf8");
const detailPanel = readFileSync(new URL("../components/TravelerInsightsPanel.tsx", import.meta.url), "utf8");
const correctionForm = readFileSync(new URL("../components/PlaceCorrectionForm.tsx", import.meta.url), "utf8");
const placeCard = readFileSync(new URL("../components/PlaceCard.tsx", import.meta.url), "utf8");
const correctionPage = readFileSync(new URL("../components/PlaceCorrectionPageView.tsx", import.meta.url), "utf8");
const adminCorrections = readFileSync(new URL("../components/AdminCorrectionWorkflow.tsx", import.meta.url), "utf8");
const aiGenerator = readFileSync(new URL("../lib/place-ai/generator.ts", import.meta.url), "utf8");

assert.match(migration, /traveler_insights jsonb not null default '\{\}'::jsonb/);
assert.match(migration, /jsonb_typeof\(traveler_insights\) = 'object'/);
assert.match(migration, /Existing RLS policies on place_china_info cover this column/);
assert.match(detailPanel, /if \(!tags\.length && !dateLabel\) return null/);
assert.match(detailPanel, /최근 정보가 오래되었습니다/);
assert.match(correctionForm, /정보가 달라요/);
assert.match(correctionForm, /"closed"/);
assert.match(correctionForm, /"location"/);
assert.match(correctionForm, /presentation === "standalone"/);
assert.match(placeCard, /`\/places\/\$\{place\.slug\}\/report`/);
assert.doesNotMatch(placeCard, /placeHref}#place-correction/);
assert.match(correctionPage, /presentation="standalone"/);
assert.match(adminCorrections, /장소 수정/);
assert.match(adminCorrections, /"accepted"/);
assert.match(aiGenerator, /traveler_insights contains admin-verified structured facts/);

console.log("Traveler insight tests passed (normalization, legacy migration, freshness, corrections, and AI read-only context).");
