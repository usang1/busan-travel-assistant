import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/busan-districts.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const module = { exports: {} };

new Function("module", "exports", "require", output)(module, module.exports, () => {
  throw new Error("busan-districts.ts must not have runtime imports");
});

const {
  buildBusanDistrictTags,
  busanDistrictOptions,
  getBusanDistrictKey,
  getBusanDistrictLabel,
  inferBusanDistrictKey,
  isBusanDistrictKey,
} = module.exports;

assert.equal(busanDistrictOptions.length, 16);
assert.equal(new Set(busanDistrictOptions.map((district) => district.key)).size, 16);
assert.equal(isBusanDistrictKey("suyeong-gu"), true);
assert.equal(isBusanDistrictKey("gangnam-gu"), false);
assert.equal(getBusanDistrictLabel("haeundae-gu", "ko"), "해운대구");
assert.equal(getBusanDistrictLabel("gijang-gun", "en"), "Gijang-gun");
assert.equal(inferBusanDistrictKey("부산광역시 수영구 광안해변로 219"), "suyeong-gu");
assert.equal(inferBusanDistrictKey("부산 강서구 명지국제8로"), "gangseo-gu");
assert.equal(inferBusanDistrictKey("부산 서구 송도해변로"), "seo-gu");
assert.equal(inferBusanDistrictKey("부산 기장군 기장읍"), "gijang-gun");
assert.equal(inferBusanDistrictKey("서울 강남구"), null);

const districtTags = buildBusanDistrictTags("suyeong-gu");
assert.equal(districtTags[0].slug, "busan-district-suyeong-gu");
assert.equal(getBusanDistrictKey({ address_ko: "부산 해운대구", tags: districtTags }), "suyeong-gu");
assert.equal(getBusanDistrictKey({ address_ko: "부산 해운대구", tags: [] }), "haeundae-gu");

console.log("Busan district tests passed (16 districts, localized labels, address inference, and explicit tag priority).");
