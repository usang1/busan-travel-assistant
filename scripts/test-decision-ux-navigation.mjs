import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../components/HomeDiscoveryPage.tsx", import.meta.url), "utf8");
const localizedHome = readFileSync(new URL("../app/[locale]/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/Header.tsx", import.meta.url), "utf8");
const bottomNavigation = readFileSync(new URL("../components/BottomNavigation.tsx", import.meta.url), "utf8");
const nearby = readFileSync(new URL("../components/NearbyExplorer.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

for (const message of [
  "한국에서 실패하지 않는 여행",
  "在韩国旅行，少踩坑",
  "Make fewer mistakes in Korea",
  "韓国で失敗しない旅",
]) {
  assert.match(home, new RegExp(message));
}

assert.match(localizedHome, /getCachedPublicPlaces\(locale\)/);
assert.match(localizedHome, /translatedPlaceLocales\(place\)\.includes\(locale\)/);
assert.match(home, /const districtCounts = getDistrictCounts\(places\)/);
assert.match(home, /\.filter\(\(district\) => district\.count > 0\)/);
assert.match(home, /activeCities\.map/);
assert.match(home, /preparingCities\(preparingCityCount\)/);
assert.match(home, /aria-disabled="true"/);
assert.match(home, /districtEmptyCopy/);
assert.match(home, /withLocale\("\/contact", locale\)/);

assert.doesNotMatch(header, /href: "\/guides"/);
for (const href of ["/", "/places", "/nearby", "/itinerary", "/saved"]) {
  assert.match(header, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  assert.match(bottomNavigation, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
}
assert.match(bottomNavigation, /grid-cols-5/);
assert.match(bottomNavigation, /min-w-0/);
assert.match(bottomNavigation, /aria-current=\{active \? "page" : undefined\}/);

assert.match(nearby, /role="tablist"/);
assert.match(nearby, /role="tabpanel"/);
assert.match(nearby, /h-\[46dvh\]/);
assert.match(nearby, /searchAreaVisible=\{mapMoved\}/);
assert.match(nearby, /onViewportSettled/);
assert.match(nearby, /SelectedPlaceSummary/);
assert.match(nearby, /locationDenied: "位置权限被拒绝/);
assert.match(nearby, /locationDenied: "Location permission was denied/);
assert.match(nearby, /locationDenied: "位置情報の権限が拒否されました/);
assert.match(nearby, /locationDenied: "위치 권한이 거부되었습니다/);

for (const label of ["places: \"找地点\"", "places: \"Find places\"", "places: \"スポット検索\"", "places: \"장소 찾기\"", "nearby: \"附近地图\"", "nearby: \"Nearby map\"", "nearby: \"近くの地図\"", "nearby: \"내 주변 지도\""]) {
  assert.match(i18n, new RegExp(label));
}

console.log("Decision UX tests passed (multi-city scope, dynamic Busan districts, five-item navigation, mobile map/list, and four locales).");
