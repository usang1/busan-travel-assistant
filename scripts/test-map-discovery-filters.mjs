import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const nearbyExplorer = readFileSync(new URL("../components/NearbyExplorer.tsx", import.meta.url), "utf8");
const travelMap = readFileSync(new URL("../components/TravelMap.tsx", import.meta.url), "utf8");
const locationSource = readFileSync(new URL("../lib/location.ts", import.meta.url), "utf8");

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

const { calculateDistanceMeters, isValidCoordinates } = locationModule.exports;

assert.equal(isValidCoordinates({ latitude: 35.15, longitude: 129.11 }), true);
assert.equal(isValidCoordinates({ latitude: null, longitude: 129.11 }), false);
assert.equal(isValidCoordinates({ latitude: Number.NaN, longitude: 129.11 }), false);
assert.equal(isValidCoordinates({ latitude: 0, longitude: 0 }), false);
assert.equal(isValidCoordinates({ latitude: 91, longitude: 129.11 }), false);

const roughlyHalfKilometer = calculateDistanceMeters(
  { latitude: 35.15, longitude: 129.11 },
  { latitude: 35.1545, longitude: 129.11 },
);
assert.ok(roughlyHalfKilometer >= 490 && roughlyHalfKilometer <= 510);

assert.match(nearbyExplorer, /type MapCategoryFilter = [^;]*"saved"/);
assert.match(nearbyExplorer, /\.from\("place_saves"\)[\s\S]*\.select\("place_id"\)[\s\S]*\.eq\("user_id", user\.id\)/);
assert.match(nearbyExplorer, /savedPlaceIds\.has\(item\.place\.id\)/);
assert.match(nearbyExplorer, /distanceFromUser !== null && distanceFromUser <= distanceLimit/);
assert.match(nearbyExplorer, /initialSelectionAppliedRef/);
assert.doesNotMatch(nearbyExplorer, /filteredItems\.find\([^\n]+\) \?\? filteredItems\[0\]/);

assert.match(travelMap, /currentLocationFocusRequest <= lastFocusedLocationRequestRef\.current/);
assert.match(travelMap, /lastFocusedLocationRequestRef\.current = currentLocationFocusRequest/);
assert.match(travelMap, /onRequestCurrentLocation/);
assert.match(travelMap, /mapCopy\[locale\]/);
assert.doesNotMatch(travelMap, />\s*我\s*</);

console.log("Map discovery tests passed (saved/category filters, coordinate validation, distance calculation, and explicit location focus)." );
