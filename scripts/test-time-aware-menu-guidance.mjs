import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compileCommonJs(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, () => ({}));
  return module.exports;
}

const time = compileCommonJs("../lib/time-aware-place.ts");
const menu = compileCommonJs("../lib/menu-guidance.ts");

function operatingProfile(overrides = {}) {
  return {
    place_id: "place-1",
    timezone: "Asia/Seoul",
    structured_operating_hours: [
      { weekday: 5, open: "18:00", close: "02:00", closed: false, overnight: true },
      { weekday: 6, open: "10:00", close: "20:00", closed: false, overnight: false },
    ],
    last_order_time: "01:00",
    temporary_closures: [],
    recommended_time_ranges: [{ weekdays: [5], start: "22:00", end: "01:00", note: "night" }],
    avoid_time_ranges: [],
    wait_time_by_weekday_hour: { "5-23": 35 },
    sellout_risk_by_hour: { "5-22": 5 },
    photo_time_ranges: [{ weekdays: [5], start: "18:00", end: "19:00", note: "sunset" }],
    seasonal_availability: [{ start_month: 6, end_month: 8, note: "summer only" }],
    holiday_notes: {},
    verification_status: "verified",
    last_verified_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const friday2330 = time.seoulDateTimeToDate("2026-09-18", "23:30");
const overnight = time.getTimeAwarePlaceState({ operating_profile: operatingProfile() }, { now: friday2330 });
assert.equal(overnight.openNow, true, "Friday overnight hours should remain open before midnight");
assert.equal(overnight.recommendedAtArrival, true, "An overnight recommended range should match Friday night");
assert.equal(overnight.selloutRiskAtArrival, null);
assert.equal(overnight.waitMinutesInOneHour, null, "One-hour wait lookup must use the next local date/hour");

const friday2230 = time.getTimeAwarePlaceState(
  { operating_profile: operatingProfile() },
  { now: time.seoulDateTimeToDate("2026-09-18", "22:30") },
);
assert.equal(friday2230.selloutRiskAtArrival, 5);
assert.equal(friday2230.waitMinutesInOneHour, 35);

const saturday0030 = time.seoulDateTimeToDate("2026-09-19", "00:30");
const afterMidnight = time.getTimeAwarePlaceState({ operating_profile: operatingProfile() }, { now: saturday0030 });
assert.equal(afterMidnight.openNow, true, "Friday overnight hours should remain open on Saturday after midnight");
assert.equal(afterMidnight.recommendedAtArrival, true, "The previous weekday overnight recommendation should remain active");
assert.equal(afterMidnight.code, "last_order_soon");
assert.equal(afterMidnight.minutesUntilLastOrder, 30);

const afterLastOrder = time.getTimeAwarePlaceState(
  { operating_profile: operatingProfile({ recommended_time_ranges: [{ weekdays: [5], start: "22:00", end: "02:00", note: "night" }] }) },
  { now: time.seoulDateTimeToDate("2026-09-19", "01:30") },
);
assert.equal(afterLastOrder.code, "after_last_order");
assert.equal(afterLastOrder.openAtArrival, false);
assert.equal(afterLastOrder.recommendedAtArrival, false, "A recommended range must not override a passed last order");

const closesBeforeArrival = time.getTimeAwarePlaceState(
  { operating_profile: operatingProfile() },
  { now: time.seoulDateTimeToDate("2026-09-18", "23:30"), travelMinutes: 180 },
);
assert.equal(closesBeforeArrival.code, "closes_before_arrival");
assert.equal(closesBeforeArrival.openAtArrival, false);

const temporaryClosed = time.getTimeAwarePlaceState(
  { operating_profile: operatingProfile({ temporary_closures: [{ start_date: "2026-09-19", end_date: "2026-09-19", reason: "관리자 메모" }] }) },
  { now: saturday0030 },
);
assert.equal(temporaryClosed.code, "temporary_closed");
assert.doesNotMatch(time.getTimeAwareNotices(temporaryClosed, "zh").join(" "), /관리자 메모/);

const sunset = time.getTimeAwarePlaceState(
  { operating_profile: operatingProfile() },
  { now: time.seoulDateTimeToDate("2026-09-18", "18:30") },
);
assert.equal(sunset.sunsetPhotoTimeAtArrival, true);
assert.equal(sunset.minutesUntilPhotoWindowEnd, 30);
assert.match(time.getTimeAwareNotices(sunset, "en").join(" "), /30 min/);
assert.equal(sunset.seasonAvailable, false, "September must not be inferred as summer availability");

const unknown = time.getTimeAwarePlaceState({ operating_profile: null }, { now: friday2330 });
assert.equal(unknown.openNow, null);
assert.equal(unknown.recommendedAtArrival, null);
const unverified = time.getTimeAwarePlaceState({ operating_profile: operatingProfile({ verification_status: "unverified" }) }, { now: friday2330 });
assert.equal(unverified.hasStructuredData, false, "Unreviewed hours must not produce a definitive status");

function menuItem(overrides = {}) {
  return {
    id: "menu-1",
    place_id: "place-1",
    name_zh: "翻译菜单名",
    name_ko: "한국어 메뉴",
    description_zh: "",
    description_ko: "",
    price: 12000,
    is_recommended: false,
    sort_order: 0,
    localized_name: { ko: "한국어 메뉴", zh: "翻译菜单名", en: "Translated menu", ja: "翻訳メニュー" },
    korean_original_name: "한국어 원문 메뉴",
    recommendation_status: "yes",
    recommendation_basis: "administrator",
    spicy_level: 1,
    oily_level: 1,
    aroma_level: 1,
    portion_size: 3,
    recommended_party_size: 2,
    contains_seafood: "unknown",
    contains_cilantro: "unknown",
    meal_type: "meal",
    sold_out_risk: null,
    ...overrides,
  };
}

const preferences = { people: 2, spicy: "avoid", oily: "avoid", seafood: "avoid", cilantro: "avoid", budget: 30000, mealType: "meal", representativeFirst: true };
const guidance = menu.recommendMenuCombination([menuItem()], preferences, "zh");
assert.equal(guidance.lines.length, 1);
assert.equal(guidance.total, 12000);
assert.equal(guidance.koreanOrderText, "한국어 원문 메뉴 하나 주세요.");
assert.doesNotMatch(guidance.koreanOrderText, /翻译菜单名/);
assert.match(guidance.warnings.join(" "), /海鲜信息尚未确认/);
assert.match(guidance.warnings.join(" "), /香菜信息尚未确认/);

const explicitSeafood = menu.recommendMenuCombination([menuItem({ contains_seafood: "yes" })], preferences, "en");
assert.equal(explicitSeafood.lines.length, 0, "An explicit seafood item must be excluded when seafood is avoided");

const unknownTaste = menu.recommendMenuCombination([menuItem({ spicy_level: null, oily_level: null })], preferences, "en");
assert.match(unknownTaste.warnings.join(" "), /Spice level is unverified/);
assert.match(unknownTaste.warnings.join(" "), /Oiliness is unverified/);

const unavailableMenu = menu.recommendMenuCombination(
  [menuItem({ availability_time: [{ weekdays: [5], start: "18:00", end: "19:00" }] })],
  preferences,
  "ko",
  time.seoulDateTimeToDate("2026-09-18", "12:00"),
);
assert.equal(unavailableMenu.lines.length, 0, "A menu outside its explicit availability window must not be recommended");

const budgetMenu = menu.recommendMenuCombination([
  menuItem({ id: "expensive", price: 40000, sort_order: 0 }),
  menuItem({ id: "budget-1", price: 8000, recommendation_status: "unknown", recommendation_basis: "", sort_order: 1 }),
  menuItem({ id: "budget-2", price: 8000, recommendation_status: "unknown", recommendation_basis: "", sort_order: 2 }),
], { ...preferences, budget: 20000 }, "ko");
assert.equal(budgetMenu.total, 16000);
assert.deepEqual(Array.from(budgetMenu.lines, (line) => line.item.id), ["budget-1", "budget-2"]);

const orderGuide = readFileSync(new URL("../components/OrderGuide.tsx", import.meta.url), "utf8");
assert.match(orderGuide, /1인분 주세요/);
assert.match(orderGuide, /koreanMenuName/);
const adminRoute = readFileSync(new URL("../app/api/admin/places/[id]/traveler-decision/route.ts", import.meta.url), "utf8");
assert.match(adminRoute, /contains_seafood: item\.contains_seafood/);
assert.match(adminRoute, /contains_cilantro: item\.contains_cilantro/);
assert.match(adminRoute, /meal_type: item\.meal_type/);
for (const file of [
  "../components/HomeDiscoveryPage.tsx",
  "../components/PlaceCard.tsx",
  "../components/NearbyExplorer.tsx",
  "../app/[locale]/places/[slug]/page.tsx",
]) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  assert.match(source, /TimeAware|getTimeAware/, `${file} must use time-aware place data`);
}

const itinerary = readFileSync(new URL("../components/ItineraryPlanner.tsx", import.meta.url), "utf8");
assert.match(itinerary, /startDate/);
assert.match(itinerary, /timeWarnings/);
const tripPlanner = readFileSync(new URL("../components/TripPlanner.tsx", import.meta.url), "utf8");
assert.match(tripPlanner, /planned_time/);
assert.match(tripPlanner, /getTripScheduleState/);
assert.match(tripPlanner, /insufficient_travel_time/);
for (const file of ["../lib/trip-store.ts", "../lib/guest-trips.ts", "../lib/guest-sync.ts"]) {
  assert.match(readFileSync(new URL(file, import.meta.url), "utf8"), /planned_time/, `${file} must preserve planned visit times`);
}
const migration = readFileSync(new URL("../supabase/migrations/031_menu_guidance_facts.sql", import.meta.url), "utf8");
assert.match(migration, /contains_seafood public\.place_fact_tristate/);
assert.match(migration, /contains_cilantro public\.place_fact_tristate/);
assert.match(migration, /meal_type text/);
assert.match(migration, /planned_time time without time zone/);
assert.match(migration, /insert into public\.trip_places\(trip_id, place_id, day_number, sort_order, memo, planned_time\)/);
assert.doesNotMatch(migration, /default\s+'(yes|no)'/i, "Unknown menu facts must not receive a yes/no default");

console.log("Time-aware status, overnight hours, menu guidance, Korean staff phrases, and UI integration tests passed.");
