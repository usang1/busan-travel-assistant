import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function read(path) { return readFileSync(new URL(path, import.meta.url), "utf8"); }
function compile(path, modules) {
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => modules[name] ?? {});
  return module.exports;
}

const timeState = (place, options) => ({
  hasStructuredData: place.hoursKnown !== false,
  code: place.testCode ?? "open_at_arrival",
  arrivalAt: options.scheduledAt ?? new Date(), travelMinutes: options.travelMinutes ?? 0,
  openNow: true, openAtArrival: place.testCode ? false : true, canVisitWithinHour: true,
  recommendedAtArrival: null, avoidAtArrival: false, photoTimeAtArrival: null,
  sunsetPhotoTimeAtArrival: null, minutesUntilPhotoWindowEnd: null, nightRecommended: null,
  seasonAvailable: null, seasonNote: "", waitMinutesInOneHour: null, selloutRiskAtArrival: null,
  minutesUntilClose: 120, minutesUntilLastOrder: 90, nextOpenTime: null, temporaryClosureReason: "",
});
const planner = compile("../lib/grounded-trip-planner.ts", {
  "@/lib/city-regions": {
    cityRegions: (city) => city === "seoul" ? [{ key: "gangnam-gu" }] : city === "jeju" ? [{ key: "jeju-si" }] : [{ key: "haeundae-gu" }],
    parsePlaceCity: (value) => ["busan", "seoul", "jeju"].includes(value) ? value : "busan",
    placeCityLabels: {
      busan: { ko: "부산", zh: "釜山", en: "Busan", ja: "釜山" },
      seoul: { ko: "서울", zh: "首尔", en: "Seoul", ja: "ソウル" },
      jeju: { ko: "제주", zh: "济州", en: "Jeju", ja: "済州" },
    },
  },
  "@/lib/i18n": { getPlaceContent: (place) => ({ name: place.name_ko, address: place.address_ko }) },
  "@/lib/location": {
    hasCoordinates: (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    calculateDistanceMeters: (a, b) => Math.round(Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude) * 90_000),
    estimateWalkingMinutes: (meters) => meters === null ? null : Math.max(1, Math.round(meters / 80)),
  },
  "@/lib/menu-guidance": { recommendMenuCombination: () => ({ lines: [], total: null, warnings: [], koreanOrderText: "" }) },
  "@/lib/place-publication-quality": { isVerifiedPlace: (place) => place.testVerified === true },
  "@/lib/place-publishing": { isPublicPlace: (place) => place.is_active === true && ["PUBLISHED", "ACTIVE"].includes(place.status) },
  "@/lib/place-scope": { isCityScopedPlace: (place, city) => place.city_code === city && place.testScoped !== false },
  "@/lib/time-aware-place": {
    getTimeAwarePlaceState: timeState,
    formatTimeAwarePrimary: (state) => ({ text: state.code, tone: "positive" }),
    getTimeAwareNotices: () => [],
  },
});

const uuids = {
  open: "00000000-0000-4000-8000-000000000001",
  closed: "00000000-0000-4000-8000-000000000002",
  seoul: "00000000-0000-4000-8000-000000000003",
  draft: "00000000-0000-4000-8000-000000000004",
};
function place(id, overrides = {}) {
  return {
    id, slug: id, name_ko: id, name_zh: id, category: "restaurant", city_code: "busan", district_code: "haeundae-gu",
    address_ko: "부산광역시 해운대구", address_zh: "釜山", latitude: 35.16, longitude: 129.16,
    short_description_ko: "돼지고기", short_description_zh: "猪肉", tags: [], menu_items: [], translations: [], sources: [],
    thumbnail_url: "", is_active: true, status: "PUBLISHED", price_min: 10000, price_max: 20000,
    china_info: { verification_status: "verified", luggage_friendly: "unknown" },
    decision_profile: { verification_status: "verified", recommended_for: [], primary_warning: {}, last_verified_at: "2026-09-20T00:00:00Z" },
    operating_profile: { structured_operating_hours: [{}] }, testVerified: true, ...overrides,
  };
}
const request = planner.normalizeGroundedTripRequest({
  request_text: "지금 해운대인데 3시간 남았고 저녁은 돼지고기, 많이 걷기는 싫어. 2명",
  conditions: { language: "ko", current_location: { label: "", city_code: "busan", district_code: null }, start_time: "2026-09-23T09:00:00+09:00", saved_places: [] },
}, new Date("2026-09-23T00:00:00Z"));
assert.equal(request.conditions.available_minutes, 180);
assert.equal(request.conditions.current_location.city_code, "busan");
assert.equal(request.conditions.current_location.district_code, "haeundae-gu");
assert.equal(request.conditions.walking_preference, "low");
assert.equal(request.conditions.party_size, 2);
assert.ok(request.conditions.desired_food.includes("pork"));

const seoulRequest = planner.normalizeGroundedTripRequest({
  request_text: "지금 강남인데 3시간 남았어요",
  conditions: { language: "ko", current_location: { label: "", district_code: null }, start_time: "2026-09-23T09:00:00+09:00" },
}, new Date("2026-09-23T00:00:00Z"));
assert.equal(seoulRequest.conditions.current_location.city_code, "seoul");
assert.equal(seoulRequest.conditions.current_location.district_code, "gangnam-gu");

const candidates = [
  place(uuids.open),
  place(uuids.closed, { testCode: "closed_today", latitude: 35.161 }),
  place(uuids.seoul, { city_code: "seoul", district_code: "gangnam-gu", address_ko: "서울특별시 강남구", latitude: 37.5, longitude: 127.03 }),
  place(uuids.draft, { is_active: false, status: "DRAFT" }),
];
const ranked = planner.rankGroundedCandidates(candidates, request.conditions);
assert.deepEqual(ranked.map((item) => item.place.id).sort(), [uuids.closed, uuids.open].sort(), "Only public, reviewed candidates in the selected city may reach time evaluation");
const plan = planner.buildGroundedTripPlan({ places: candidates, conditions: request.conditions });
assert.deepEqual(plan.places.map((item) => item.id), [uuids.open], "A confirmed closed place must not enter the executable route");
assert.equal(plan.places[0].menu_guidance, null, "Missing menu data must not create a recommendation");
assert.equal(plan.places[0].arrival_time.includes("T"), true);
const seoulPlan = planner.buildGroundedTripPlan({ places: candidates, conditions: seoulRequest.conditions });
assert.deepEqual(seoulPlan.places.map((item) => item.id), [uuids.seoul]);
assert.match(seoulPlan.route_title, /서울/);
assert.throws(() => planner.validateAiSelection({ ordered_place_ids: ["99999999-9999-4999-8999-999999999999"] }, new Set([uuids.open])), /unknown place ID/, "AI IDs outside the server candidate set must be rejected");

const recovery = planner.buildGroundedTripPlan({ places: candidates, conditions: request.conditions, existingItinerary: [{ place_id: uuids.closed, planned_time: "18:00", stay_minutes: 30 }] });
assert.equal(recovery.recovery.checked, true);
assert.equal(recovery.recovery.issues[0].place_id, uuids.closed);
assert.equal(recovery.recovery.changes[0].from_place_id, uuids.closed);

const api = read("../app/api/grounded-trip-plan/route.ts");
assert.match(api, /isSameOrigin\(request\)/);
assert.match(api, /getCachedPublicPlaces\(normalized\.conditions\.language, normalized\.conditions\.current_location\.city_code\)/);
assert.match(api, /rankGroundedCandidates\(places, normalized\.conditions\)/);
assert.match(api, /preferredOrderIds/);
assert.doesNotMatch(api, /request_text[\s\S]{0,200}orderGroundedTripCandidates/, "Raw prompts must not be forwarded to the model");
const ai = read("../lib/grounded-trip-ai.ts");
assert.match(ai, /store: false/);
assert.match(ai, /validateAiSelection/);
assert.match(ai, /Never add a place ID or factual claim/);
const server = read("../lib/grounded-trip-server.ts");
assert.match(server, /httpOnly: true/);
assert.match(server, /sameSite: "lax"/);
assert.doesNotMatch(server, /x-forwarded-for|cf-connecting-ip|request\.ip/);

const ui = read("../components/GroundedTripPlanner.tsx");
assert.match(ui, /TravelMap/);
assert.match(ui, /DirectionsButton/);
assert.match(ui, /window\.confirm\(text\.replaceConfirm\)/, "Existing trips require explicit confirmation before replacement");
assert.match(ui, /saveNew/);
assert.match(ui, /checkTrip/);
const tripUi = read("../components/TripPlanner.tsx");
assert.match(tripUi, /saveGuestTripLayout\(trip\.id, layout\)/);
assert.match(tripUi, /removeTripPlace/);

const migration = read("../supabase/migrations/035_grounded_trip_planning.sql");
assert.match(migration, /register_grounded_trip_plan_request/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /interval '1 hour'/);
assert.match(migration, /interval '24 hours'/);
assert.match(migration, /Raw prompts, exact coordinates, itineraries, and profile data are intentionally not stored/);
assert.match(migration, /grant execute on function public\.register_grounded_trip_plan_request[\s\S]+to service_role/);

console.log("Grounded planning filters, closed-place exclusion, AI ID validation, explicit recovery, privacy, and save integration tests passed.");
