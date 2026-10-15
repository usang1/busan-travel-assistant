import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const fixture = {
  id: "place-1", slug: "test-place", name_ko: "장소", name_zh: "地点", price_level: 1,
  admin_summary: "PRIVATE_ADMIN_SUMMARY", verification_checked_by: "PRIVATE_REVIEWER", verification_note: "PRIVATE_REVIEW_NOTE",
  latitude: 35.1, longitude: 129.1,
  place_translations: [{ locale: "en", name: "Public name" }],
  place_sources: [{ source_url: "https://map.naver.com/place/1", raw_metadata: { secret: "PRIVATE_PROVIDER_DATA" } }],
  place_menu_items: [{ price: 10000, name_ko: "메뉴", sort_order: 0 }], place_tags: [], place_china_info: { chinese_menu: "yes" },
};
const modules = {
  "@/lib/place-saves": { getPlaceSaveCounts: async () => new Map(), withPlaceSaveCounts: (places) => places },
  "@/lib/place-data-integrity": { normalizeMenuPrice: (price) => price, normalizePlacePricing: () => ({ priceTier: 1, priceMin: 10000, priceMax: 10000 }) },
  "@/lib/place-scope": { filterCityScopedPlaces: (places) => places, isSupportedCityScopedPlace: () => true },
  "@/lib/place-publication-quality": { filterPublishablePlaces: (places) => places, isPublishablePlace: () => true },
  "@/lib/place-publishing": { publicReadablePlaceStatuses: ["PUBLISHED"] },
  "@/lib/place-validation": {},
  "@/lib/supabase": { getSupabaseClient: () => null },
};
const output = ts.transpileModule(readFileSync("lib/place-store.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", output)(module, module.exports, (name) => {
  assert.ok(name in modules, `Unexpected import ${name}`);
  return modules[name];
});
const { getPlaces, getPlaceBySlug } = module.exports;
function clientFor(fallbackIndex) {
  let selectIndex = -1;
  const filters = [];
  const query = {
    select() { selectIndex++; return query; }, order() { return query; }, eq() { return query; }, limit() { return query; },
    in(key, values) { filters.push({ key, values }); return query; },
    maybeSingle: async () => selectIndex < fallbackIndex ? { error: { message: "missing relation" }, data: null } : { data: fixture, error: null },
    then(resolve, reject) { return Promise.resolve(selectIndex < fallbackIndex ? { error: { message: "missing relation" }, data: null } : { data: [fixture], error: null }).then(resolve, reject); },
  };
  return { from: () => query, filters };
}
function checkPublic(place) {
  assert.doesNotMatch(JSON.stringify(place), /PRIVATE_/);
  for (const key of ["place_translations", "place_sources", "place_menu_items", "place_tags", "place_china_info"]) assert.equal(key in place, false, `No duplicate raw relation: ${key}`);
  assert.equal(place.translations[0].name, "Public name");
  assert.equal(place.menu_items[0].price, 10000);
  assert.equal(place.sources[0].source_url, fixture.place_sources[0].source_url);
}
for (const fallbackIndex of [0, 1, 2, 3]) {
  const client = clientFor(fallbackIndex);
  checkPublic((await getPlaces({ debugLabel: "boundary-test", ids: [fixture.id] }, client)).places[0]);
  assert.equal(client.filters.filter(({ key }) => key === "id").length, fallbackIndex + 1, "Every fallback must retain ownership scope");
  checkPublic((await getPlaceBySlug(fixture.slug, {}, clientFor(fallbackIndex))).place);
  const admin = (await getPlaces({ activeOnly: false, includeAdminRelations: true }, clientFor(fallbackIndex))).places[0];
  assert.equal(admin.admin_summary, fixture.admin_summary);
  assert.equal(admin.sources[0].raw_metadata.secret, "PRIVATE_PROVIDER_DATA");
}
assert.equal(fixture.admin_summary, "PRIVATE_ADMIN_SUMMARY", "Redaction must not modify stored data");
console.log("Public place boundary passed: all four query fallbacks, internal-field redaction, relation deduplication, scoped owner queries, and admin preservation.");
