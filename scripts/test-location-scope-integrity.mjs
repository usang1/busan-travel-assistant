import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, dependencies = {}) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected import in ${path}: ${specifier}`);
  });
  return module.exports;
}

const districts = compile("lib/busan-districts.ts");
const cities = compile("lib/city-regions.ts", { "@/lib/busan-districts": districts });
const scope = compile("lib/place-scope.ts", {
  "@/lib/busan-districts": districts,
  "@/lib/city-regions": cities,
});
const transit = compile("lib/transit-labels.ts");
const phrases = compile("lib/korean-phrases.ts");

const validBusan = {
  city_code: "busan",
  district_code: "suyeong-gu",
  address_ko: "부산광역시 수영구 광안로49번길 87 1층",
  latitude: 35.1532,
  longitude: 129.1187,
  tags: [],
};
assert.equal(scope.isBusanScopedPlace(validBusan), true);

const seoulBakery = {
  city_code: "seoul",
  district_code: "gangnam-gu",
  address_ko: "서울특별시 강남구 신사동",
  latitude: 37.519,
  longitude: 127.023,
  tags: [],
};
assert.equal(scope.isBusanScopedPlace(seoulBakery), false);
assert.ok(scope.getPlaceScopeIssues(seoulBakery).includes("not_busan"));
assert.ok(scope.getPlaceScopeIssues(seoulBakery).includes("coordinates_outside_busan"));

const conflictingCity = { ...validBusan, address_ko: "서울특별시 강남구 신사동" };
assert.ok(scope.getPlaceScopeIssues(conflictingCity).includes("city_conflict"));
assert.equal(scope.isBusanScopedPlace({ ...validBusan, district_code: null, address_ko: "부산광역시" }), false);
assert.deepEqual(scope.filterBusanScopedPlaces([validBusan, seoulBakery]), [validBusan]);

assert.equal(transit.formatLocalizedStation("광안역", "zh"), "广安站（광안역）");
assert.equal(transit.formatLocalizedExit("1번", "zh"), "1号出口");
assert.equal(transit.formatLocalizedStation("광안역", "en"), "Gwangan Station（광안역）");

assert.equal(
  phrases.buildKoreanTaxiSentence("부산광역시 수영구 광안로49번길 87 1층", "하우스멜"),
  "부산광역시 수영구 광안로49번길 87 1층 하우스멜로 가주세요.",
);
assert.equal(phrases.buildKoreanTaxiSentence("부산광역시 수영구", "맛있는집"), "부산광역시 수영구 맛있는집으로 가주세요.");

const nearbyPage = readFileSync("app/[locale]/nearby/page.tsx", "utf8");
const placesPage = readFileSync("app/[locale]/places/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/029_location_scope_and_trust_integrity.sql", "utf8");
const rankingService = readFileSync("lib/place-recommendations.ts", "utf8");
assert.match(nearbyPage, /getCachedPublicPlaces\(locale, "busan"\)/);
assert.match(placesPage, /getCachedPublicPlaces\(locale, "busan"\)/);
assert.match(migration, /add column if not exists city_code/);
assert.match(migration, /ranked\.save_count >= 3/);
assert.match(rankingService, /minimumRankingSaveCount = 3/);

console.log("Location scope integrity tests passed (Busan boundary, localized transit, Korean taxi phrase, and ranking threshold). ");
