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

function createWindow({ failReads = false, failWrites = false, initial = "{}" } = {}) {
  let stored = initial;
  const events = [];

  return {
    localStorage: {
      getItem: (key) => {
        if (failReads) throw new Error("storage unavailable");
        return key === "busan-travel-assistant-guest-trips" ? stored : null;
      },
      setItem: (_key, value) => {
        if (failWrites) throw new Error("quota exceeded");
        stored = value;
      },
      removeItem: () => {
        if (failWrites) throw new Error("quota exceeded");
        stored = "";
      },
    },
    dispatchEvent: (event) => {
      events.push(event.type);
      return true;
    },
    get stored() {
      return stored;
    },
    events,
  };
}

const guestTrips = compileCommonJs("../lib/guest-trips.ts", () => ({}));

globalThis.window = createWindow();

assert.deepEqual(guestTrips.readGuestTripStore(), { trips: [], tripPlaces: [] });

const trip = guestTrips.createGuestTrip({
  title: "Guest Busan",
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  visibility: "private",
});
assert.equal(trip.user_id, "guest");

const firstAdd = guestTrips.addGuestPlaceToTrip(trip.id, "place-a", 1);
assert.equal(firstAdd.status, "added");
assert.equal(guestTrips.getGuestTripPlaces(trip.id).length, 1);

const duplicateAdd = guestTrips.addGuestPlaceToTrip(trip.id, "place-a", 1);
assert.equal(duplicateAdd.status, "duplicate");
assert.equal(guestTrips.getGuestTripPlaces(trip.id).length, 1);
assert.equal(globalThis.window.events.includes(guestTrips.guestTripsChangeEvent), true);

const reloadedWindow = createWindow({ initial: globalThis.window.stored });
globalThis.window = reloadedWindow;
assert.equal(guestTrips.readGuestTripStore().trips.length, 1, "guest trips must survive reload");
assert.equal(guestTrips.getGuestTripPlaces(trip.id).length, 1, "guest trip places must survive reload");

const beforeFailure = reloadedWindow.stored;
globalThis.window = createWindow({ failReads: true, initial: beforeFailure });
assert.deepEqual(guestTrips.readGuestTripStore(), { trips: [], tripPlaces: [] });
assert.equal(globalThis.window.stored, beforeFailure, "failed reads must not delete existing guest trips");

globalThis.window = createWindow({ failWrites: true, initial: beforeFailure });
assert.throws(() => guestTrips.addGuestPlaceToTrip(trip.id, "place-b", 1), /quota exceeded/);
assert.equal(globalThis.window.stored, beforeFailure, "failed writes must not delete existing guest trips");

delete globalThis.window;

const addToTripButton = readFileSync(new URL("../components/AddToTripButton.tsx", import.meta.url), "utf8");
assert.doesNotMatch(addToTripButton, /if \(!user\)[\s\S]{0,120}<Link href=\{\`\$\{withLocale\("\/login"/, "guest add button must not redirect to login");
assert.match(addToTripButton, /readGuestTripStore\(\)/);
assert.match(addToTripButton, /store\.trips\.length === 1/);
assert.match(addToTripButton, /trips\.length > 1/);
assert.match(addToTripButton, /handleCreateTrip/);
assert.match(addToTripButton, /createTrip\(user\.id, createForm\)/);
assert.doesNotMatch(addToTripButton, /user && !trips\.length[\s\S]{0,220}withLocale\("\/itinerary"/, "empty trip state should create inside the add modal, not redirect to itinerary");
assert.match(addToTripButton, /result\.status === "duplicate"/);
assert.match(addToTripButton, /role="dialog"/);
assert.match(addToTripButton, /aria-modal="true"/);
assert.match(addToTripButton, /event\.key === "Escape"/);
assert.match(addToTripButton, /event\.key !== "Tab"/);
assert.match(addToTripButton, /role=\{tone === "error" \? "alert" : "status"\}/);
assert.match(addToTripButton, /aria-live=\{tone === "error" \? "assertive" : "polite"\}/);
assert.match(addToTripButton, /withLocale\("\/login", currentLocale\)\}\?next=\$\{encodeURIComponent\(nextPath\)\}/);
assert.match(addToTripButton, /pb-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\]/);
assert.match(addToTripButton, /getTripPlaces\(trip\.id\)/, "server add path should check duplicates before upsert");
for (const locale of ["ko", "zh", "en", "ja"]) {
  assert.match(addToTripButton, new RegExp(`${locale}: \\{[\\s\\S]*?added:[\\s\\S]*?duplicate:[\\s\\S]*?storageFailed:`, "m"));
}

const tripPlanner = readFileSync(new URL("../components/TripPlanner.tsx", import.meta.url), "utf8");
assert.match(tripPlanner, /guestResult\?\.status === "duplicate"/);
assert.match(tripPlanner, /placedIds\.has\(placeId\)/);

const guestSync = readFileSync(new URL("../lib/guest-sync.ts", import.meta.url), "utf8");
const firstFailureReturn = guestSync.indexOf("if (saveResult.error) return");
const tripFailureReturn = guestSync.indexOf("if (tripResult.error) return");
const clearIndex = guestSync.indexOf("clearGuestTrips()");
assert.ok(firstFailureReturn > -1 && firstFailureReturn < clearIndex, "save merge failure must return before clearing local data");
assert.ok(tripFailureReturn > -1 && tripFailureReturn < clearIndex, "trip merge failure must return before clearing local data");

const savedItems = readFileSync(new URL("../components/SavedItemsView.tsx", import.meta.url), "utf8");
assert.match(savedItems, /<AddToTripButton placeId=\{place\.id\}/);
assert.match(savedItems, /useSearchParams\(\)/);
assert.match(savedItems, /encodeURIComponent\(nextPath\)/);

console.log("Guest trip add flow tests passed (0/1/many trips, duplicate prevention, storage failure, merge safety, a11y modal, and localized next path).");
