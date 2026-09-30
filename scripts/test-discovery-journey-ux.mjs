import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("../components/HomeDiscoveryPage.tsx", import.meta.url), "utf8");
const places = readFileSync(new URL("../components/PlacesExplorer.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/PlaceCard.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../app/[locale]/places/[slug]/page.tsx", import.meta.url), "utf8");
const directions = readFileSync(new URL("../lib/directions.ts", import.meta.url), "utf8");
const directionsButton = readFileSync(new URL("../components/DirectionsButton.tsx", import.meta.url), "utf8");
const trust = readFileSync(new URL("../lib/place-trust.ts", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

for (const label of [
  'places: "找地点"',
  'nearby: "附近地图"',
  'places: "Find places"',
  'nearby: "Nearby map"',
  'places: "スポット検索"',
  'nearby: "近くの地図"',
  'places: "장소 찾기"',
  'nearby: "내 주변 지도"',
]) {
  assert.match(i18n, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(home, /<HomeSearchForm locale=\{locale\} socialDiscoveryEnabled=\{socialDiscoveryEnabled\} \/>/);
assert.match(home, /activeCities\.map/);
assert.match(home, /preparingCities\(preparingCityCount\)/);
assert.match(home, /filters\.filter\(\(filter\) => filter\.enabled\)\.map/);
assert.match(home, /availableIntentCards\.map/);
assert.match(home, /nextPendingIntentCard/);
assert.doesNotMatch(home, /disabled\s+title=\{unavailableLabel\}/);

assert.match(places, /setTimeout\(\(\) => setDebouncedQuery\(query\), 400\)/);
assert.match(places, /clearSearch/);
assert.match(places, /searching/);
assert.match(places, /availableCategoryFilters/);
assert.match(places, /suggestedCategories/);
assert.match(places, /viewAllCity/);
assert.match(places, /resultSummary\(filteredPlaces\.length, places\.length\)/);

assert.match(card, /getPublicPlaceDescription/);
assert.match(card, /line-clamp-2/);
assert.match(trust, /infoPreparing: "정보 보강 중"/);
assert.doesNotMatch(trust, /\$\{content\.name\} \(\$\{copy\[locale\]\.originalNameLabel\}\)/);

assert.match(detail, /방문 전 30초 체크|到访前 30 秒确认|30-second visit check|訪問前30秒チェック/);
assert.match(detail, /unknownTitle/);
assert.match(detail, /buildVisitCheckItems/);
assert.doesNotMatch(detail, /value=\{placeHasCoordinates \? `\$\{place\.latitude\}, \$\{place\.longitude\}`/);

assert.match(directions, /"naver_web"/);
assert.match(directions, /https:\/\/map\.naver\.com\/p\/search/);
assert.match(directionsButton, /Naver web map|Naver 网页地图|네이버 웹지도|Naverウェブ地図/);
assert.match(directionsButton, /rel="noopener noreferrer"/);

assert.match(pkg.scripts.test, /test-discovery-journey-ux\.mjs/);

console.log("Discovery journey UX tests passed (nav labels, hero/search, empty states, cards, detail checks, and map fallbacks).");
