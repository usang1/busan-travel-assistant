import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const nearbyExplorer = readFileSync(new URL("../components/NearbyExplorer.tsx", import.meta.url), "utf8");
const bottomNavigation = readFileSync(new URL("../components/BottomNavigation.tsx", import.meta.url), "utf8");
const homeDiscovery = readFileSync(new URL("../components/HomeDiscoveryPage.tsx", import.meta.url), "utf8");
const homeSearchForm = readFileSync(new URL("../components/HomeSearchForm.tsx", import.meta.url), "utf8");
const placesExplorer = readFileSync(new URL("../components/PlacesExplorer.tsx", import.meta.url), "utf8");
const travelMap = readFileSync(new URL("../components/TravelMap.tsx", import.meta.url), "utf8");
const locationSource = readFileSync(new URL("../lib/location.ts", import.meta.url), "utf8");
const directionsSource = readFileSync(new URL("../lib/directions.ts", import.meta.url), "utf8");
const placeSearchUrlSource = readFileSync(new URL("../lib/place-search-url.ts", import.meta.url), "utf8");

const compiledLocation = ts.transpileModule(locationSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const locationModule = { exports: {} };

new Function("module", "exports", "require", compiledLocation)(locationModule, locationModule.exports, () => {
  throw new Error("location.ts must not have runtime imports");
});

const compiledDirections = ts.transpileModule(directionsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const directionsModule = { exports: {} };

new Function("module", "exports", "require", compiledDirections)(directionsModule, directionsModule.exports, () => {
  throw new Error("directions.ts must not have runtime imports");
});

const compiledPlaceSearchUrl = ts.transpileModule(placeSearchUrlSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const placeSearchUrlModule = { exports: {} };

new Function("module", "exports", "require", compiledPlaceSearchUrl)(placeSearchUrlModule, placeSearchUrlModule.exports, (specifier) => {
  if (specifier === "@/lib/i18n") {
    return {
      withLocale(path, locale) {
        return path === "/" ? `/${locale}` : `/${locale}${path}`;
      },
    };
  }

  throw new Error(`Unexpected runtime import from place-search-url.ts: ${specifier}`);
});

const { calculateDistanceMeters, formatDistance, isValidCoordinates } = locationModule.exports;
const { buildDirectionsUrl } = directionsModule.exports;
const { buildLocalizedPlacesSearchHref, readPlacesSearchQuery } = placeSearchUrlModule.exports;

assert.equal(isValidCoordinates({ latitude: 35.15, longitude: 129.11 }), true);
assert.equal(isValidCoordinates({ latitude: null, longitude: 129.11 }), false);
assert.equal(isValidCoordinates({ latitude: Number.NaN, longitude: 129.11 }), false);
assert.equal(isValidCoordinates({ latitude: 0, longitude: 0 }), false);
assert.equal(isValidCoordinates({ latitude: 91, longitude: 129.11 }), false);
assert.equal(formatDistance(null, "ko"), "거리 확인 필요");
assert.equal(formatDistance(null, "en"), "Distance needs checking");
assert.equal(buildLocalizedPlacesSearchHref("ko", " 카페 "), "/ko/places?search=%EC%B9%B4%ED%8E%98");
assert.equal(buildLocalizedPlacesSearchHref("zh", " 咖啡 "), "/zh/places?search=%E5%92%96%E5%95%A1");
assert.equal(buildLocalizedPlacesSearchHref("en", " cafe "), "/en/places?search=cafe");
assert.equal(buildLocalizedPlacesSearchHref("ja", " カフェ "), "/ja/places?search=%E3%82%AB%E3%83%95%E3%82%A7");
assert.equal(buildLocalizedPlacesSearchHref("ko", "   "), "/ko/places");
assert.equal(readPlacesSearchQuery(new URLSearchParams("search=%EC%B9%B4%ED%8E%98&category=cafe")), "카페");
assert.equal(readPlacesSearchQuery(new URLSearchParams("q=legacy")), "legacy");

const roughlyHalfKilometer = calculateDistanceMeters(
  { latitude: 35.15, longitude: 129.11 },
  { latitude: 35.1545, longitude: 129.11 },
);
assert.ok(roughlyHalfKilometer >= 490 && roughlyHalfKilometer <= 510);

const coordinates = { latitude: 35.1532, longitude: 129.1186 };
assert.equal(
  buildDirectionsUrl({ provider: "google", name: "광안리해수욕장", address: "부산 수영구 광안해변로", coordinates }),
  "https://www.google.com/maps/dir/?api=1&destination=35.1532%2C129.1186&travelmode=walking",
);
assert.equal(
  buildDirectionsUrl({ provider: "kakao", name: "광안리해수욕장", coordinates }),
  "https://map.kakao.com/link/to/%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EC%88%98%EC%9A%95%EC%9E%A5,35.1532,129.1186",
);
assert.match(
  buildDirectionsUrl({ provider: "naver", name: "광안리해수욕장", coordinates }),
  /^nmap:\/\/route\/walk\?dlat=35\.1532&dlng=129\.1186&dname=/,
);
assert.match(
  buildDirectionsUrl({ provider: "google", name: "광안리해수욕장", address: "부산 수영구 광안해변로", coordinates: null }),
  /destination=%EA%B4%91%EC%95%88%EB%A6%AC%ED%95%B4%EC%88%98%EC%9A%95%EC%9E%A5%20%EB%B6%80%EC%82%B0%20%EC%88%98%EC%98%81%EA%B5%AC/,
);

assert.match(nearbyExplorer, /type MapCategoryFilter = [^;]*"saved"/);
assert.match(nearbyExplorer, /useSearchParams\(\)/);
assert.match(nearbyExplorer, /new URLSearchParams\(\)/);
assert.match(nearbyExplorer, /router\.replace\(nextQuery \? `\$\{pathname\}\?\$\{nextQuery\}` : pathname, \{ scroll: false \}\)/);
assert.match(nearbyExplorer, /\.from\("place_saves"\)[\s\S]*\.select\("place_id"\)[\s\S]*\.eq\("user_id", user\.id\)/);
assert.match(nearbyExplorer, /savedPlaceIds\.has\(item\.place\.id\)/);
assert.match(nearbyExplorer, /distanceFromUser !== null && distanceFromUser <= distanceLimit/);
assert.match(nearbyExplorer, /initialSelectionAppliedRef/);
assert.doesNotMatch(nearbyExplorer, /filteredItems\.find\([^\n]+\) \?\? filteredItems\[0\]/);
assert.match(bottomNavigation, /key: "itinerary", href: "\/itinerary"/);
assert.doesNotMatch(bottomNavigation, /key: "submit"/);
assert.match(homeDiscovery, /getHomeQuickFilters\(places\)/);
assert.match(homeSearchForm, /role="search"/);
assert.match(homeSearchForm, /buildLocalizedPlacesSearchHref\(locale, query\)/);
assert.doesNotMatch(homeSearchForm, /params\.set\("q", trimmed\)/);
assert.match(homeSearchForm, /enterKeyHint="search"/);
assert.match(homeSearchForm, /onCompositionStart=/);
assert.match(homeSearchForm, /nativeEvent\.isComposing/);
assert.match(homeSearchForm, /disabled=\{isNavigating\}/);
assert.match(placesExplorer, /readPlacesSearchQuery\(searchParams\)/);
assert.match(placesExplorer, /nextParams\.set\("search", query\.trim\(\)\)/);
assert.match(placeSearchUrlSource, /searchParams\.get\("search"\) \?\? searchParams\.get\("q"\) \?\? ""/);

assert.match(travelMap, /currentLocationFocusRequest <= lastFocusedLocationRequestRef\.current/);
assert.match(travelMap, /lastFocusedLocationRequestRef\.current = currentLocationFocusRequest/);
assert.match(travelMap, /onRequestCurrentLocation/);
assert.match(travelMap, /mapCopy\[locale\]/);
assert.match(travelMap, /scriptStatus === "error"[\s\S]*<FallbackTravelMap/);
assert.match(travelMap, /fallbackReason \|\| markers\.length === 0/);
assert.doesNotMatch(travelMap, />\s*我\s*</);

console.log("Map discovery tests passed (saved/category filters, coordinate validation, distance calculation, and explicit location focus)." );
