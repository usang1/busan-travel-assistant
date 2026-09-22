import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const filename = path.resolve("lib/traveler-decision-display.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require: () => ({}) }, { filename });

const { getDecisionWarnings, getPracticalFacts, getThemeLabels, getWorthLabel } = module.exports;
const basePlace = {
  card_payment: false, chinese_menu: false, solo_friendly: false, luggage_friendly: false,
  china_info: null, decision_profile: null, operating_profile: null,
};

assert.equal(getWorthLabel(basePlace, "ko"), "확인된 정보 부족");
assert.equal(getWorthLabel(basePlace, "zh"), "已确认的信息不足");
assert.deepEqual(Array.from(getThemeLabels(["solo", "rainy_day"], "ja")), ["一人旅", "雨の日"]);

const unknownFacts = getPracticalFacts(basePlace, "en");
assert.equal(unknownFacts.find((fact) => fact.key === "foreign_card").status, "unknown", "Legacy false must remain unknown");
assert.equal(unknownFacts.find((fact) => fact.key === "restroom").value, "Unknown");

const explicitPlace = {
  ...basePlace,
  china_info: {
    foreign_card: "unknown", chinese_menu: "no", alipay: "unknown", wechat_pay: "unknown",
    solo_friendly: "unknown", luggage_friendly: "no", toilet_available: "no", reservation_required: "yes",
    minimum_order_policy: "two_plus", minimum_order_people: 2, waiting_level: "long",
    kiosk_language_support: { status: "yes", languages: ["ko"] }, traveler_insights: {},
  },
};
for (const locale of ["ko", "zh", "en", "ja"]) {
  const warnings = getDecisionWarnings(explicitPlace, locale);
  assert.ok(warnings.length >= 5, `${locale} should expose explicit failure warnings`);
  assert.ok(warnings.every(Boolean));
}
assert.match(getDecisionWarnings(explicitPlace, "zh").join(" "), /无中文菜单/);
assert.equal(getPracticalFacts(explicitPlace, "ko").find((fact) => fact.key === "reservation").value, "필요");

const cardSource = fs.readFileSync("components/TravelerDecisionCard.tsx", "utf8");
for (const file of [
  "components/PlaceCard.tsx",
  "components/NearbyExplorer.tsx",
  "components/SavedItemsView.tsx",
  "app/[locale]/places/[slug]/page.tsx",
]) {
  assert.match(fs.readFileSync(file, "utf8"), /TravelerDecisionCard/, `${file} must use the shared decision card`);
}
assert.match(cardSource, /CircleHelp/, "Unknown state must have a non-color indicator");
assert.match(cardSource, /getDecisionWarnings/);
assert.match(fs.readFileSync("lib/place-store.ts", "utf8"), /place_decision_profiles\(\*\).*place_operating_profiles\(\*\)/);
assert.match(fs.readFileSync("components/SavedItemsView.tsx", "utf8"), /getPublicPlacesByIds/);

process.stdout.write("Traveler decision cards, multilingual warnings, tri-state facts, and shared query coverage passed.\n");
