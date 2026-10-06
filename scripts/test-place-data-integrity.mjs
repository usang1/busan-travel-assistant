import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, modules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => modules[name] ?? {});
  return module.exports;
}

const integrity = compile("../lib/place-data-integrity.ts");
assert.equal(integrity.normalizeMenuPrice(null), null);
assert.equal(integrity.normalizeMenuPrice(0), 0);
assert.equal(integrity.normalizeMenuPrice(999), null);
assert.equal(integrity.normalizeMenuPrice(1000), 1000);
assert.equal(integrity.normalizeMenuPrice(1200.5), null);
assert.equal(integrity.normalizePriceTier("₩₩₩₩"), 4);
assert.equal(integrity.normalizePriceTier(5), null);

const legacyTier = integrity.normalizePlacePricing({ category: "restaurant", price_level: null, price_min: 1, price_max: 2 });
assert.deepEqual({ tier: legacyTier.priceTier, min: legacyTier.priceMin, max: legacyTier.priceMax }, { tier: 2, min: null, max: null });
const reversed = integrity.normalizePlacePricing({ category: "restaurant", price_level: 2, price_min: 20_000, price_max: 10_000 });
assert.equal(reversed.priceMin, null);
assert.equal(reversed.priceMax, null);
assert.ok(reversed.issues.includes("reversed_price_range"));

const legacyFacts = { china_info: null, card_payment: false, solo_friendly: false, chinese_menu: false, luggage_friendly: false };
assert.equal(integrity.resolvePlaceFact(legacyFacts, "card_payment"), "unknown");
assert.equal(integrity.resolvePlaceFact({ ...legacyFacts, card_payment: true }, "card_payment"), "yes");
assert.equal(integrity.resolvePlaceFact({ ...legacyFacts, china_info: { foreign_card: "no" } }, "card_payment"), "no");
assert.equal(integrity.isUsableChineseAddress("釜山广域市 水营区 Muhak-ro 9beon-gil 132号"), false);
assert.equal(integrity.isUsableChineseAddress("釜山广域市釜山镇区全浦大路206号 오월생咖啡馆"), false);
assert.equal(integrity.isUsableChineseAddress("釜山广域市水营区舞鹤路9番街132"), true);
assert.ok(integrity.diagnosePlaceData({ name_ko: "테스트", name_zh: "测试", short_description_zh: "店方 안내 可以外带", menu_items: [] }).some((issue) => issue.code === "mixed_korean_in_chinese_copy"));

const quality = compile("../lib/place-quality.ts", {
  "@/lib/location": { isValidCoordinates: ({ latitude, longitude }) => typeof latitude === "number" && typeof longitude === "number" },
  "@/lib/place-data-integrity": integrity,
});
const complete = {
  status: "PUBLISHED", is_active: true, name_ko: "테스트", name_zh: "测试", category: "restaurant",
  address_ko: "부산광역시 수영구 테스트로 1", latitude: 35.1, longitude: 129.1,
  short_description_ko: "검수된 설명입니다 충분한 길이", short_description_zh: "这是经过审核的地点说明。", opening_hours: "10:00-20:00",
  price_level: 2, price_min: 10_000, price_max: 20_000, last_verified_at: "2026-10-01T00:00:00Z",
  sources: [{ source_url: "https://map.naver.com/p/entry/place/1" }],
  menu_items: [{ is_recommended: true, name_ko: "메뉴", name_zh: "菜单", price: 10_000 }],
  china_info: { waiting_level: "short", foreign_card: "yes", solo_friendly: "yes", verification_status: "verified" },
};
assert.equal(quality.evaluatePlaceQuality(complete, new Date("2026-10-06T00:00:00Z")).canPublish, true);
assert.equal(quality.evaluatePlaceQuality({ ...complete, last_verified_at: null }, new Date("2026-10-06T00:00:00Z")).canPublish, false);
assert.equal(quality.evaluatePlaceQuality({ ...complete, sources: [], website: null }, new Date("2026-10-06T00:00:00Z")).canPublish, false);

const publication = compile("../lib/place-publication-quality.ts", {
  "@/lib/place-quality": quality,
  "@/lib/place-publishing": {
    archivedPlaceStatus: "ARCHIVED", draftPlaceStatus: "DRAFT", reviewPlaceStatus: "REVIEW", legacyInactivePlaceStatus: "INACTIVE",
    isPublicPlace: (place) => place.is_active && ["PUBLISHED", "ACTIVE"].includes(place.status),
  },
});
assert.equal(publication.isVerifiedPlace(complete, new Date("2026-10-06T00:00:00Z")), true);
assert.equal(publication.isVerifiedPlace({ ...complete, sources: [] }, new Date("2026-10-06T00:00:00Z")), false);

const seo = compile("../lib/place-seo.ts", { "@/lib/place-data-integrity": integrity });
const seoPlace = { ...complete, name_ko: "테스트식당", name_zh: "测试餐厅", translations: [{ locale: "zh", name: "测试餐厅" }], card_payment: false, solo_friendly: false, chinese_menu: false, luggage_friendly: false };
const verifiedDescription = seo.buildTrustedPlaceMetaDescription(seoPlace, "zh", true);
assert.match(verifiedDescription, /韩文原名：테스트식당/);
assert.match(verifiedDescription, /₩10,000–₩20,000/);
assert.match(verifiedDescription, /已确认可刷卡/);
assert.doesNotMatch(verifiedDescription, /辣|油腻|口味/);
assert.equal((seo.buildTrustedPlaceMetaDescription({ ...seoPlace, price_min: 10_000, price_max: 10_000 }, "ko", true).match(/₩10,000/g) ?? []).length, 1);
const unverifiedDescription = seo.buildTrustedPlaceMetaDescription({ ...seoPlace, china_info: null }, "zh", false);
assert.doesNotMatch(unverifiedDescription, /刷卡|一个人/);

const submission = compile("../lib/place-submission-validation.ts", {
  "@/lib/map-url": { parseMapUrl: (value) => value.includes("naver.com") ? { provider: "naver", normalizedUrl: value } : { provider: "unknown", normalizedUrl: value } },
});
assert.equal(submission.validateSubmissionLocation({ mapUrl: "https://map.naver.com/p/entry/place/1", name: "", locationText: "" }).valid, true);
assert.equal(submission.validateSubmissionLocation({ mapUrl: "https://example.com", name: "장소", locationText: "부산" }).valid, false);
assert.equal(submission.validateSubmissionLocation({ mapUrl: "", name: "장소", locationText: "부산 수영구" }).valid, true);
assert.equal(submission.validateSubmissionLocation({ mapUrl: "", name: "장소", locationText: "" }).valid, false);
assert.match(readFileSync(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"), /validateSubmissionLocation\(\{ mapUrl, name, locationText \}\)/);
assert.match(readFileSync(new URL("../components/PlaceSubmissionForm.tsx", import.meta.url), "utf8"), /validateSubmissionLocation\(\{ mapUrl, name, locationText \}\)/);

console.log("Place price normalization, tristate facts, review eligibility, SEO, address, and submission validation tests passed.");
