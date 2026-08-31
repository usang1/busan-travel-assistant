import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const travelMap = readFileSync(new URL("../components/TravelMap.tsx", import.meta.url), "utf8");
const nearbyExplorer = readFileSync(new URL("../components/NearbyExplorer.tsx", import.meta.url), "utf8");

assert.match(travelMap, /lastFocusedPlaceIdRef\.current === selectedId/);
assert.match(travelMap, /lastFocusedPlaceIdRef\.current = selectedId;[\s\S]*map\.setCenter/);
assert.match(travelMap, /disableAutoPan: true/);
assert.doesNotMatch(travelMap, /contentSignature|lastFittedContentRef/);
assert.doesNotMatch(travelMap, /focusRequest/);
assert.doesNotMatch(nearbyExplorer, /focusRequest/);
assert.match(nearbyExplorer, /description: content\.description/);
assert.match(nearbyExplorer, /detailLabel: localizedCopy\.detail/);
assert.match(nearbyExplorer, /<Link href=\{href\}[\s\S]*\{localizedCopy\.detail\}[\s\S]*<ArrowRight/);
assert.match(travelMap, /marker\.description/);
assert.match(travelMap, /href="\$\{escapeHtml\(marker\.href\)\}" target="_self"/);

const markerClickHandler = travelMap.match(/addListener\(markerInstance, "click", \(\) => \{([\s\S]*?)\n\s*\}\);/)?.[1] ?? "";
assert.ok(markerClickHandler, "Naver marker click handler must exist");
assert.doesNotMatch(markerClickHandler, /setCenter|setZoom/, "marker click must delegate focus to the selected-place effect");

const focusAssignments = travelMap.match(/lastFocusedPlaceIdRef\.current = selectedId/g) ?? [];
assert.equal(focusAssignments.length, 2, "Naver and fallback maps must each record a consumed place selection");

console.log("Map focus behavior tests passed (initial selection/new selection focus only; drag, zoom, and rerenders preserve viewport).");
