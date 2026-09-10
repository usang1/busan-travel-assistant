import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const cache = new Map();
function load(request) {
  if (!request.startsWith("@/")) return require(request);
  if (cache.has(request)) return cache.get(request);
  const stem = path.resolve(request.slice(2));
  const filename = [stem + ".ts", stem + ".tsx"].find(fs.existsSync);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  cache.set(request, module.exports);
  vm.runInNewContext(source, { exports: module.exports, module, require: load, process, console, URL, Intl, Date, Set, Map }, { filename });
  return module.exports;
}
const seo = load("@/lib/public-seo");
const i18n = load("@/lib/i18n");
const trust = load("@/lib/place-trust");
const place = {
  id: "fixture-place", slug: "fixture-cafe", category: "cafe", status: "PUBLISHED", is_active: true,
  name_ko: "테스트 카페", name_zh: "测试咖啡馆", short_description_ko: "지역의 대표 메뉴와 이용 정보를 확인한 공개 장소입니다.", short_description_zh: "这是一家提供咖啡与甜品的咖啡馆，出发前请确认营业信息。",
  tips_ko: "", tips_zh: "", waiting_info_ko: "", waiting_info_zh: "", recommended_order_ko: "", recommended_order_zh: "",
  address_ko: "부산 수영구", address_zh: "釜山水营区", opening_hours: "10:00-20:00",
  price_min: null, price_max: null, latitude: 35.153, longitude: 129.118, phone: "", website: "",
  thumbnail_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e", menu_items: [], tags: [], sources: [],
  translations: [{ locale: "en", name: "Fixture cafe", description: "A public cafe offering coffee and desserts with confirmed visitor information.", address: "Suyeong-gu, Busan" }],
};
assert.deepEqual(Array.from(seo.translatedPlaceLocales(place)).sort(), ["en", "ko", "zh"]);
assert.equal(seo.translatedPlaceLocales({ ...place, status: "DRAFT" }).length, 0);
assert.equal(seo.translatedPlaceLocales({ ...place, is_active: false }).length, 0);
for (const [category, schemaType] of Object.entries({ restaurant: "Restaurant", cafe: "CafeOrCoffeeShop", bar: "BarOrPub", attraction: "TouristAttraction", photo_spot: "TouristAttraction", shopping: "Store", luggage: "SelfStorage" })) {
  const schema = seo.placeSchema({ ...place, category }, "en");
  assert.equal(schema["@type"], schemaType);
  assert.equal(schema.image, undefined, "Generic fallback images must not enter JSON-LD");
  assert.equal(schema.priceRange, undefined, "Unknown prices must not be invented");
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.geo.latitude, place.latitude);
}
const unknown = seo.placeSchema({ ...place, latitude: null, longitude: null, translations: [] }, "ja");
assert.equal(unknown.geo, undefined);
assert.equal(unknown.description, undefined);
assert.equal(seo.placeSchema({ ...place, price_min: 0, price_max: 0 }, "ko").priceRange, "0 - 0 KRW");
assert.equal(trust.getPublicOpeningHours({ opening_hours: "매일 10:00-20:00" }, "en"), "");
assert.equal(trust.getPublicOpeningHours(place, "ja"), "10:00-20:00");
const alternates = i18n.localeAlternates("/places/fixture-cafe", seo.translatedPlaceLocales(place));
assert.equal(alternates.ja, undefined);
assert.equal(new URL(alternates.en).pathname, "/en/places/fixture-cafe");
assert.equal(Object.keys(i18n.localeAlternates("/places/fixture-cafe", [])).length, 0);
const metadata = i18n.buildLocalizedMetadata({ locale: "en", title: "Places", description: "Find places", path: "/places", availableLocales: ["en"] });
assert.equal(new URL(metadata.alternates.canonical).pathname, "/en/places");
assert.equal(metadata.alternates.languages.ko, undefined);
assert.equal(metadata.twitter.card, "summary_large_image");
assert.ok(metadata.openGraph.images.length);
const breadcrumbs = seo.breadcrumbSchema([{ name: "Home", url: "https://example.com/en" }, { name: "Places", url: "https://example.com/en/places" }]);
assert.deepEqual(Array.from(breadcrumbs.itemListElement, (item) => item.position), [1, 2]);
const guide = { status: "PUBLISHED", title_ko: "가이드", description_ko: "가이드 설명", title_zh: "", description_zh: "", title_en: "Guide", description_en: "Guide description", title_ja: "Guide", description_ja: "" };
assert.deepEqual(Array.from(seo.translatedGuideLocales(guide)).sort(), ["en", "ko"]);
assert.equal(seo.translatedGuideLocales({ ...guide, status: "DRAFT" }).length, 0);
const { renderToStaticMarkup } = require("react-dom/server");
const { createElement } = require("react");
const { StructuredData } = load("@/components/StructuredData");
const markup = renderToStaticMarkup(createElement(StructuredData, { data: { name: "</script><script>alert(1)</script>" } }));
assert.doesNotMatch(markup, /<script>alert/);
assert.match(markup, /\\u003c/);
console.log("Public SEO tests passed: real schema types/data, locale eligibility, metadata, breadcrumbs and JSON-LD escaping.");
