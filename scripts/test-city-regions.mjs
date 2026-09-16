import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(file) {
  const source = readFileSync(`lib/${file}.ts`, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => {
    assert.equal(name, "@/lib/busan-districts");
    return load("busan-districts");
  });
  return module.exports;
}

const { cityRegions, getPlaceRegion, buildPlaceRegionTags, inferPlaceCity, inferCityRegion, isPlaceRegionTag, placeRegionLabel } = load("city-regions");
assert.equal(cityRegions("seoul").length, 25);
assert.equal(cityRegions("busan").length, 16);
assert.equal(cityRegions("jeju").length, 2);

for (const [city, key, address] of [
  ["busan", "gangseo-gu", "부산광역시 강서구 명지동"],
  ["seoul", "gangseo-gu", "서울특별시 강서구 마곡동"],
  ["seoul", "gangnam-gu", "서울특별시 강남구 역삼동"],
  ["jeju", "jeju-si", "제주특별자치도 제주시 연동"],
  ["jeju", "seogwipo-si", "제주특별자치도 서귀포시 중문동"],
]) {
  assert.equal(inferPlaceCity(address), city);
  assert.equal(inferCityRegion(city, address), key);
  const tags = buildPlaceRegionTags(city, key, address);
  assert.ok(tags.every((tag) => isPlaceRegionTag(tag.slug)));
  assert.deepEqual(getPlaceRegion({ tags }), { city, region_key: key });
  assert.deepEqual(getPlaceRegion({ address_ko: address }), { city, region_key: key });
  assert.deepEqual(buildPlaceRegionTags(city, "", address), tags);
}
assert.deepEqual(getPlaceRegion({ tags: [{ slug: "busan-district-suyeong-gu" }] }), { city: "busan", region_key: "suyeong-gu" });
assert.equal(inferCityRegion("busan", "서울특별시 강서구"), "");
assert.equal(buildPlaceRegionTags("jeju", "gangnam-gu", "").length, 1);
assert.equal(placeRegionLabel("seoul", "", ""), "서울");
assert.equal(isPlaceRegionTag("home-intent-solo-travel"), false);
// eslint-disable-next-line no-console
console.log("City/region inference, persistence, and Busan compatibility passed.");
