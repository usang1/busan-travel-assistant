import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compileCommonJs(path, requireModule) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  const module = { exports: {} };

  new Function("module", "exports", "require", output)(module, module.exports, requireModule);
  return module.exports;
}

const location = compileCommonJs("../lib/location.ts", (specifier) => {
  throw new Error(`Unexpected runtime import from location.ts: ${specifier}`);
});
const scoring = compileCommonJs("../lib/place-recommendation-score.ts", (specifier) => {
  if (specifier === "@/lib/location") return location;
  throw new Error(`Unexpected runtime import from place-recommendation-score.ts: ${specifier}`);
});

function place(overrides) {
  return {
    id: "origin",
    category: "restaurant",
    latitude: 35.15,
    longitude: 129.11,
    save_count: 0,
    menu_items: [],
    tags: [],
    short_description_ko: "",
    short_description_zh: "",
    address_ko: "",
    address_zh: "",
    opening_hours: "",
    thumbnail_url: "",
    phone: null,
    website: null,
    ...overrides,
  };
}

const origin = place({ id: "origin" });
const nearbyCafe = place({
  id: "cafe",
  category: "cafe",
  latitude: 35.151,
  save_count: 32,
  address_ko: "부산 수영구",
  thumbnail_url: "/cafe.jpg",
});
const nearbyRestaurant = place({
  id: "restaurant",
  category: "restaurant",
  latitude: 35.151,
  save_count: 32,
});
const farCafe = place({ id: "far", category: "cafe", latitude: 35.2, save_count: 1000 });

const complementary = scoring.scoreRelatedPlace(origin, nearbyCafe);
const sameCategory = scoring.scoreRelatedPlace(origin, nearbyRestaurant);
assert.ok(complementary && sameCategory);
assert.ok(complementary.score > sameCategory.score, "a nearby complementary category should rank higher");
assert.equal(scoring.scoreRelatedPlace(origin, farCafe), null, "places beyond 3 km must be excluded");
assert.equal(scoring.scoreRelatedPlace(origin, origin), null, "the current place must not recommend itself");

assert.equal(
  scoring.scoreNearbyPopularPlace({ latitude: 35.15, longitude: 129.11 }, place({ id: "unsaved", latitude: 35.151 })),
  null,
  "near-me popularity excludes places with no saves",
);
assert.ok(scoring.scoreNearbyPopularPlace({ latitude: 35.15, longitude: 129.11 }, nearbyCafe));

const bounds = scoring.buildCoordinateBounds({ latitude: 35.15, longitude: 129.11 }, 3000);
assert.ok(bounds.minLatitude < 35.15 && bounds.maxLatitude > 35.15);
assert.ok(bounds.minLongitude < 129.11 && bounds.maxLongitude > 129.11);

const migration = readFileSync(new URL("../supabase/migrations/017_place_rankings_and_recommendations.sql", import.meta.url), "utf8");
const recommendationService = readFileSync(new URL("../lib/place-recommendations.ts", import.meta.url), "utf8");
const saveButton = readFileSync(new URL("../components/SaveButton.tsx", import.meta.url), "utf8");
const explorer = readFileSync(new URL("../components/PlacesExplorer.tsx", import.meta.url), "utf8");
const nearbyRoute = readFileSync(new URL("../app/api/places/recommendations/route.ts", import.meta.url), "utf8");

assert.match(migration, /get_place_rankings/);
assert.match(migration, /created_at >= now\(\) - interval '7 days'/);
assert.match(migration, /place_saves_place_created_idx/);
assert.match(migration, /places_active_coordinates_idx/);
assert.match(migration, /set_place_saved/);
assert.match(migration, /on conflict \(user_id, place_id\) do nothing/);
assert.match(recommendationService, /getPublicPlacesInBounds\(bounds, 60\)/);
assert.doesNotMatch(recommendationService, /getPlaces\(/);
assert.match(saveButton, /\.rpc\("set_place_saved"/);
assert.doesNotMatch(saveButton, /setSaveCount\(\(current\)/, "save count must not be updated optimistically");
assert.match(explorer, /<PlaceRankingSection rankings=\{rankings\}/);
assert.doesNotMatch(explorer, /const popularPlaces = useMemo/);
assert.match(nearbyRoute, /validCoordinates\(latitude, longitude\)/);
assert.match(nearbyRoute, /Cache-Control": "private, no-store/);

console.log("Place recommendation tests passed (rankings, distance scoring, server queries, and authoritative saves).");
