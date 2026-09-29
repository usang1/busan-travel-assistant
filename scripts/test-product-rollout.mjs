import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = read("../supabase/migrations/036_product_rollout_analytics.sql");
const requiredEvents = [
  "home_view", "city_selected", "district_selected", "filter_applied", "place_impression",
  "place_opened", "decision_card_viewed", "warning_viewed", "place_saved", "map_opened",
  "route_saved", "itinerary_created", "itinerary_place_added", "sns_search_started",
  "sns_candidate_confirmed", "ai_route_created", "ai_route_saved", "visit_confirmed",
  "fact_report_submitted", "report_accepted", "report_conflicted",
];
for (const event of requiredEvents) assert.match(migration, new RegExp(`'${event}'`), `Missing funnel event ${event}`);
assert.match(migration, /octet_length\(metadata::text\) <= 4096/);
assert.match(migration, /Do not store raw search text, exact coordinates, email, phone, tokens/);

const analytics = read("../lib/place-events.ts");
assert.match(analytics, /forbiddenMetadataKey/);
for (const sensitive of ["email", "phone", "token", "secret", "request_text", "latitude", "longitude", "address"]) {
  assert.match(analytics, new RegExp(sensitive));
}
assert.match(analytics, /Analytics must never block the core user action/);
const attribution = read("../lib/analytics-source.ts");
assert.match(attribution, /landing_path: sanitizePath\(current\?\.landing_path \|\| window\.location\.pathname\)/);
assert.match(attribution, /value\.split\(\/\[\?\#\]\//);
assert.doesNotMatch(attribution, /landing_path:[^\n]+window\.location\.search/);

const componentEvents = new Map([
  ["../components/HomeDiscoveryPage.tsx", ["home_view"]],
  ["../components/PlaceCard.tsx", ["place_impression"]],
  ["../components/TravelerDecisionCard.tsx", ["decision_card_viewed", "warning_viewed"]],
  ["../components/SaveButton.tsx", ["place_saved"]],
  ["../components/DirectionsButton.tsx", ["map_opened"]],
  ["../components/TripPlanner.tsx", ["route_saved", "itinerary_created", "itinerary_place_added", "ai_route_saved"]],
  ["../components/SocialPlaceFinder.tsx", ["sns_search_started", "sns_candidate_confirmed"]],
  ["../components/TravelerVerification.tsx", ["visit_confirmed", "fact_report_submitted"]],
  ["../components/NearbyExplorer.tsx", ["filter_applied"]],
]);
for (const [file, events] of componentEvents) {
  const source = read(file);
  for (const event of events) assert.match(source, new RegExp(`"${event}"`), `${file} does not emit ${event}`);
}

const env = read("../.env.example");
for (const flag of [
  "SOCIAL_DISCOVERY_ENABLED=false", "NEXT_PUBLIC_SOCIAL_DISCOVERY_ENABLED=false",
  "GROUNDED_TRIP_PLANNER_ENABLED=false", "NEXT_PUBLIC_GROUNDED_TRIP_PLANNER_ENABLED=false",
  "ITINERARY_RECOVERY_ENABLED=false", "NEXT_PUBLIC_ITINERARY_RECOVERY_ENABLED=false",
  "NEXT_PUBLIC_TRAVELER_EVIDENCE_UPLOAD_ENABLED=false", "NEXT_PUBLIC_VISIT_PROXIMITY_VERIFICATION_ENABLED=false",
]) assert.match(env, new RegExp(flag));

const socialApi = read("../app/api/social-discovery/search/route.ts");
const groundedApi = read("../app/api/grounded-trip-plan/route.ts");
assert.match(socialApi, /isSocialDiscoveryEnabled\(\)/);
assert.match(groundedApi, /isGroundedTripPlannerEnabled\(\)/);
assert.match(groundedApi, /normalized\.mode === "recover" && !isItineraryRecoveryEnabled\(\)/);

const verification = read("../components/TravelerVerification.tsx");
assert.match(verification, /role="dialog"/);
assert.match(verification, /aria-modal="true"/);
assert.match(verification, /event\.key !== "Tab"/);
assert.match(verification, /triggerRef\.current\?\.focus\(\)/);
assert.match(verification, /정확한 위치는 서버에 보내거나 저장하지 않습니다/);
const navigation = read("../components/BottomNavigation.tsx");
assert.match(navigation, /safe-area-inset-bottom/);
assert.match(navigation, /(?:min-h-12|h-14)/);
const analyticsLink = read("../components/AnalyticsLink.tsx");
assert.match(analyticsLink, /recordProductEvent/);
const home = read("../components/HomeDiscoveryPage.tsx");
assert.match(home, /eventType="city_selected"/);
assert.match(home, /eventType="district_selected"/);
const rootLayout = read("../app/layout.tsx");
assert.match(rootLayout, /fallback={<div className="h-\[129px\]/, "Header suspense fallback must reserve space to prevent layout shift");

const sitemap = read("../app/sitemap.ts");
assert.match(sitemap, /hasBusanContent/);
for (const thinLanding of ["solo-trip", "rainy-day", "late-night", "low-wait"]) {
  assert.doesNotMatch(sitemap, new RegExp(thinLanding), `Thin SEO landing ${thinLanding} must not be indexed without data`);
}

console.log("Product rollout analytics, privacy, feature flags, accessibility, and SEO guard tests passed.");
