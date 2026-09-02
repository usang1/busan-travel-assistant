import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compileCommonJs(path, requireModule) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, requireModule);
  return module.exports;
}

const location = compileCommonJs("../lib/location.ts", (specifier) => {
  throw new Error(`Unexpected location runtime import: ${specifier}`);
});
const planner = compileCommonJs("../lib/trip-planner.ts", (specifier) => {
  if (specifier === "@/lib/location") return location;
  throw new Error(`Unexpected trip planner runtime import: ${specifier}`);
});

assert.equal(planner.getTripDayCount("2026-09-02", "2026-09-04"), 3);
assert.equal(planner.getTripDayCount("invalid", "2026-09-04"), 1);
assert.equal(planner.getTripDayDate("2026-09-02", 2), "2026-09-03");

function place(id, category, latitude, longitude, openingHours = "10:00-22:00") {
  return { id, category, latitude, longitude, opening_hours: openingHours, is_active: true };
}

const places = [
  place("west-food", "restaurant", 35.15, 129.10),
  place("west-cafe", "cafe", 35.151, 129.101),
  place("east-food", "restaurant", 35.16, 129.18),
  place("east-attraction", "attraction", 35.161, 129.181),
];
const layout = planner.autoArrangeTripPlaces(places, 2);
assert.equal(layout.length, places.length);
assert.equal(new Set(layout.map((item) => item.placeId)).size, places.length);
assert.deepEqual([...new Set(layout.map((item) => item.dayNumber))], [1, 2]);
assert.deepEqual(layout.filter((item) => item.dayNumber === 1).map((item) => item.sortOrder), [0, 1]);
assert.deepEqual(layout.filter((item) => item.dayNumber === 2).map((item) => item.sortOrder), [0, 1]);
assert.equal(planner.autoArrangeTripPlaces([place("archived", "cafe", 35.1, 129.1)], 1).length, 1);
assert.equal(planner.autoArrangeTripPlaces([{ ...place("inactive", "cafe", 35.1, 129.1), is_active: false }], 1).length, 0);
const openingAware = planner.autoArrangeTripPlaces([
  place("late-attraction", "attraction", 35.15, 129.10, "18:00-23:00"),
  place("morning-cafe", "cafe", 35.151, 129.101, "08:00-18:00"),
], 1);
assert.equal(openingAware[0].placeId, "morning-cafe");

const migration = readFileSync(new URL("../supabase/migrations/018_trip_planning_and_sharing.sql", import.meta.url), "utf8");
const tripPlanner = readFileSync(new URL("../components/TripPlanner.tsx", import.meta.url), "utf8");
const tripDayMap = readFileSync(new URL("../components/TripDayMap.tsx", import.meta.url), "utf8");
const travelMap = readFileSync(new URL("../components/TravelMap.tsx", import.meta.url), "utf8");
const tripStore = readFileSync(new URL("../lib/trip-store.ts", import.meta.url), "utf8");
const savedItems = readFileSync(new URL("../components/SavedItemsView.tsx", import.meta.url), "utf8");
const sharedViewer = readFileSync(new URL("../components/SharedTripViewer.tsx", import.meta.url), "utf8");
const rootItineraryPage = readFileSync(new URL("../app/itinerary/page.tsx", import.meta.url), "utf8");

assert.match(migration, /create table if not exists public\.trips/);
assert.match(migration, /create table if not exists public\.trip_places/);
assert.match(migration, /unique \(trip_id, place_id\)/);
assert.match(migration, /visibility public\.trip_visibility not null default 'private'/);
assert.match(migration, /create or replace function public\.get_shared_trip/);
assert.match(migration, /where trips\.share_slug = source_share_slug[\s\S]*trips\.visibility = 'unlisted'/);
assert.match(migration, /revoke select on public\.trips, public\.trip_places from anon/);
assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
assert.match(migration, /public\.is_trip_owner\(trip_id\)/);
assert.match(migration, /create or replace function public\.copy_shared_trip/);
assert.match(migration, /current_user_id is null/);
assert.match(tripPlanner, /autoArrangeTripPlaces\(allPlaces, dayCount\)/);
assert.match(tripDayMap, /sequence: index \+ 1/);
assert.match(travelMap, /item\.marker\.sequence !== undefined/);
assert.match(tripStore, /rpc\("get_shared_trip"/);
assert.doesNotMatch(tripStore, /from\("trips"\)[\s\S]{0,200}share_slug/);
assert.match(savedItems, /<AddToTripButton placeId=\{place\.id\}/);
assert.match(sharedViewer, /<CopySharedTripButton/);
assert.match(rootItineraryPage, /<TripPlanner locale="zh"/);
assert.doesNotMatch(rootItineraryPage, /ItineraryPlanner/);

console.log("Trip planning tests passed (dates, rule layout, numbered map, sharing RPC, copy, and RLS contracts).");
