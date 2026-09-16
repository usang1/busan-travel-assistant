import assert from "node:assert/strict";
import fs from "node:fs";

const publicCache = fs.readFileSync("lib/public-cache.ts", "utf8");
assert.match(publicCache, /import "server-only"/);
assert.match(publicCache, /unstable_cache/);
assert.match(publicCache, /publicPlacesCacheTag/);
assert.match(publicCache, /publicGuidesCacheTag/);
assert.match(publicCache, /persistSession:\s*false/);
assert.doesNotMatch(publicCache, /cookies\(|headers\(/);

for (const file of [
  "app/[locale]/busan/page.tsx",
  "app/[locale]/places/page.tsx",
  "app/[locale]/nearby/page.tsx",
  "app/[locale]/places/[slug]/page.tsx",
]) {
  const source = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(source, /force-dynamic/, `${file} should not force public pages to be uncached`);
  assert.match(source, /publicPageRevalidateSeconds|getCachedPublic/, `${file} should use the public cache boundary`);
}

const cityHomePage = fs.readFileSync("app/[locale]/page.tsx", "utf8");
assert.doesNotMatch(cityHomePage, /force-dynamic/);
assert.doesNotMatch(cityHomePage, /getCachedPublic/, "the city-only home page should not fetch place data");

for (const file of [
  "app/[locale]/itinerary/page.tsx",
  "app/[locale]/mypage/page.tsx",
  "app/[locale]/admin/page.tsx",
]) {
  assert.match(fs.readFileSync(file, "utf8"), /force-dynamic/, `${file} must remain user/admin scoped`);
}

const savedPage = fs.readFileSync("app/[locale]/saved/page.tsx", "utf8");
assert.match(savedPage, /noIndex:\s*true/);
assert.doesNotMatch(savedPage, /getCachedPublic|unstable_cache/);

for (const file of [
  "app/api/admin/places/route.ts",
  "app/api/admin/places/[id]/route.ts",
  "app/api/admin/submissions/[id]/approve/route.ts",
]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(
    source,
    /revalidateTag\(publicPlacesCacheTag, \{ expire: 0 \}\)/,
    `${file} must immediately invalidate the public place cache`,
  );
}

for (const file of [
  "app/api/admin/guides/route.ts",
  "app/api/admin/guides/[id]/route.ts",
]) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, /revalidateTag\(publicGuidesCacheTag, "max"\)/, `${file} must invalidate public guide cache`);
}

assert.match(fs.readFileSync("app/api/places/recommendations/route.ts", "utf8"), /private, no-store/);

const nearby = fs.readFileSync("components/NearbyExplorer.tsx", "utf8");
assert.match(nearby, /const \[sheetOpen, setSheetOpen\] = useState\(false\)/);
assert.match(nearby, /const \[desktopMapMounted, setDesktopMapMounted\] = useState\(false\)/);
assert.match(nearby, /window\.matchMedia\("\(min-width: 1024px\)"\)/);
assert.match(nearby, /sheetOpen && "hidden"/);

const travelMap = fs.readFileSync("components/TravelMap.tsx", "utf8");
assert.match(travelMap, /setLoadTimedOut\(true\)/);
assert.match(travelMap, /3000/);
assert.match(travelMap, /localizedCopy\.retry/);
assert.match(travelMap, /localizedCopy\.listView/);
assert.match(travelMap, /script\[data-naver-maps-sdk='true'\]/);

const migration = fs.readFileSync("supabase/migrations/026_public_page_performance_indexes.sql", "utf8");
assert.match(migration, /places_public_slug_idx/);
assert.match(migration, /places_public_featured_updated_idx/);
assert.match(migration, /places_public_coordinates_idx/);
assert.match(migration, /guides_public_status_sort_idx/);

console.log("Public performance cache tests passed (public cache boundary, invalidation, map visibility, and DB indexes).");
