import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, modules) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => modules[name] ?? {});
  return module.exports;
}

const location = {
  hasCoordinates: (place) => typeof place.latitude === "number" && typeof place.longitude === "number",
  calculateDistanceMeters: (a, b) => Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude) * 100_000,
  estimateWalkingMinutes: (distance) => distance === null ? null : Math.max(1, Math.round(distance / 80)),
};
const timeAware = {
  getTimeAwarePlaceState: (place, options) => ({
    hasStructuredData: true,
    code: place.testCode ?? "open_at_arrival",
    arrivalAt: options.scheduledAt,
    travelMinutes: options.travelMinutes ?? 0,
    openNow: true,
    openAtArrival: place.testCode ? false : true,
    canVisitWithinHour: true,
    recommendedAtArrival: place.recommended ?? null,
    avoidAtArrival: false,
    photoTimeAtArrival: null,
    sunsetPhotoTimeAtArrival: null,
    minutesUntilPhotoWindowEnd: null,
    nightRecommended: null,
    seasonAvailable: null,
    seasonNote: "",
    waitMinutesInOneHour: null,
    selloutRiskAtArrival: null,
    minutesUntilClose: 120,
    minutesUntilLastOrder: 90,
    nextOpenTime: null,
    temporaryClosureReason: "",
  }),
};
const route = compile("../lib/practical-route.ts", {
  "@/lib/location": location,
  "@/lib/time-aware-place": timeAware,
});
const now = new Date("2026-09-22T03:00:00.000Z");
const base = { category: "cafe", latitude: 35.153, longitude: 129.118, china_info: null };
const origin = { ...base, id: "origin" };
const manual = { ...base, id: "manual", category: "attraction", longitude: 129.119 };
const automatic = { ...base, id: "automatic", category: "photo_spot", longitude: 129.12 };
const preferences = { currentStayMinutes: 15, weather: "dry", party: "solo", lowWalking: false, purpose: "auto" };
const edge = {
  from_place_id: "origin",
  to_place_id: "manual",
  travel_minutes: 5,
  travel_distance: 100,
  travel_mode: "walk",
  sequence_reason: { ko: "검수 연결", zh: "", en: "", ja: "" },
  valid_time_ranges: [],
  weather_conditions: [],
  trip_theme: [],
  active: true,
  priority: 10,
};

const manualRoute = route.buildPracticalRoute({ origin, candidates: [automatic, manual], connections: [edge], locale: "ko", preferences, now });
assert.equal(manualRoute.stops[0].place.id, "manual");
assert.equal(manualRoute.stops[0].source, "manual");

const closedManual = route.buildPracticalRoute({ origin, candidates: [automatic, { ...manual, testCode: "closed_today" }], connections: [edge], locale: "ko", preferences, now });
assert.equal(closedManual.stops[0].place.id, "automatic", "A confirmed closed place must never be the next stop");
assert.equal(closedManual.stops[0].source, "rule");

const inaccessible = { ...manual, china_info: { wheelchair_access: "no", elevator: "no" } };
const parentRoute = route.buildPracticalRoute({ origin, candidates: [inaccessible, automatic], connections: [], locale: "en", preferences: { ...preferences, party: "parents" }, now });
assert.equal(parentRoute.stops.some((stop) => stop.place.id === "manual"), false);

const migration = readFileSync(new URL("../supabase/migrations/032_practical_routes_and_course_snapshots.sql", import.meta.url), "utf8");
assert.match(migration, /copy_published_guide_to_trip/);
assert.match(migration, /verification_status in \('verified', 'partially_verified'\)/);
assert.match(migration, /source_guide_updated_at/);
assert.match(migration, /stay_minutes, travel_minutes, travel_mode, source_guide_sequence/);

const actions = readFileSync(new URL("../components/GuideCourseActions.tsx", import.meta.url), "utf8");
assert.match(actions, /selected_place_ids/);
assert.match(actions, /writeSavedItems/);
assert.match(actions, /saveGuestTripLayout/);
assert.doesNotMatch(actions, /clearSavedItems|clearGuestTrips/);

const recommendationStore = readFileSync(new URL("../lib/place-recommendations.ts", import.meta.url), "utf8");
assert.match(recommendationStore, /isVerifiedPlace\(candidate\)/);
const guideStore = readFileSync(new URL("../lib/guide-store.ts", import.meta.url), "utf8");
assert.match(guideStore, /verification_status/);
assert.match(guideStore, /isMissingGuideDecisionSchema/);
const admin = readFileSync(new URL("../components/AdminGuideManager.tsx", import.meta.url), "utf8");
assert.match(admin, /draggable/);
assert.match(admin, /비공개 장소: 공개 코스로 저장 불가/);

const directions = compile("../lib/directions.ts", {});
const originCoordinates = { latitude: 35.153, longitude: 129.118 };
const destinationCoordinates = { latitude: 35.154, longitude: 129.12 };
const googleUrl = directions.buildDirectionsUrl({ provider: "google", name: "다음 장소", coordinates: destinationCoordinates, origin: { name: "현재 장소", coordinates: originCoordinates } });
assert.match(googleUrl, /origin=35\.153%2C129\.118/);
const naverUrl = directions.buildDirectionsUrl({ provider: "naver", name: "다음 장소", coordinates: destinationCoordinates, origin: { name: "현재 장소", coordinates: originCoordinates } });
assert.match(naverUrl, /slat=35\.153&slng=129\.118/);
const kakaoUrl = directions.buildDirectionsUrl({ provider: "kakao", name: "다음 장소", coordinates: destinationCoordinates, origin: { name: "현재 장소", coordinates: originCoordinates } });
assert.match(kakaoUrl, /\/from\//);
assert.match(kakaoUrl, /\/to\//);

console.log("Practical routes, closure exclusions, course snapshots, guest preservation, and admin route editing tests passed.");
