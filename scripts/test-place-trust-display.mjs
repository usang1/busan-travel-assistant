import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTrustModule() {
  const source = fs.readFileSync("lib/place-trust.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier === "@/lib/place-store") {
      return { formatWon: (value) => (value === 0 ? "무료" : `₩${Number(value).toLocaleString("ko-KR")}`) };
    }

    if (specifier === "@/lib/i18n") {
      return {
        getLocalizedMenuItem: (item, locale) => ({
          name: item[`name_${locale}`] || item.name_ko || item.name_zh || "",
          description: item[`description_${locale}`] || "",
        }),
      };
    }

    if (specifier === "@/lib/traveler-insights") {
      return {
        verificationDateLabel: (value, locale) => value ? `${locale}:${value.slice(0, 10)}` : "",
      };
    }

    throw new Error(`Unexpected test import: ${specifier}`);
  };

  vm.runInNewContext(compiled, { exports: module.exports, module, require, URL, Intl }, { filename: "lib/place-trust.ts" });
  return module.exports;
}

const trust = loadTrustModule();

const basePlace = {
  id: "place-1",
  slug: "trusted-cafe",
  category: "cafe",
  thumbnail_url: "https://example.com/cafe.jpg",
  website: "https://example.com/cafe",
  opening_hours: "10:00-22:00",
  price_min: 6000,
  price_max: 9000,
  price_level: 2,
  solo_friendly: true,
  waiting_info_zh: "",
  waiting_info_ko: "",
  recommended_order_zh: "",
  recommended_order_ko: "",
  short_description_ko: "광안리 산책 후 들르기 좋은 조용한 카페입니다.",
  short_description_zh: "适合广安里散步后短暂停留的安静咖啡馆。",
  short_description_en: "",
  short_description_ja: "",
  tips_ko: "주말 오후에는 창가 좌석이 빨리 찹니다.",
  tips_zh: "周末下午靠窗座位较快坐满，建议提前到达。",
  tips_en: "",
  tips_ja: "",
  last_verified_at: "2026-09-01",
  admin_summary: "존맛탱",
  menu_items: [
    {
      name_ko: "필터 커피",
      name_zh: "手冲咖啡",
      name_en: "Filter coffee",
      name_ja: "フィルターコーヒー",
      description_ko: "",
      description_zh: "",
      description_en: "",
      description_ja: "",
      price: 6500,
      is_recommended: true,
      sort_order: 1,
    },
  ],
  translations: [
    {
      locale: "ko",
      description: "광안리 산책 후 들르기 좋은 조용한 카페입니다.",
      travel_tip: "주말 오후에는 창가 좌석이 빨리 찹니다.",
    },
    {
      locale: "zh",
      description: "适合广安里散步后短暂停留的安静咖啡馆。",
      travel_tip: "周末下午靠窗座位较快坐满，建议提前到达。",
    },
    {
      locale: "en",
      description: "A quiet cafe suited to a short stop after walking around Gwangalli.",
      travel_tip: "Window seats fill quickly on weekend afternoons.",
    },
    {
      locale: "ja",
      description: "広安里の散歩後に立ち寄りやすい静かなカフェです。",
      travel_tip: "週末午後は窓側席が早めに埋まります。",
    },
  ],
  sources: [{ provider: "MANUAL", source_url: "https://example.com/source", external_id: "", last_synced_at: "2026-09-01T00:00:00.000Z" }],
  china_info: {
    solo_friendly: "yes",
    waiting_level: "short",
    verification_status: "verified",
    verified_at: "2026-09-01T00:00:00.000Z",
  },
};

for (const locale of ["ko", "zh", "en", "ja"]) {
  assert.equal(trust.getPlacePhotoDisplay(basePlace, locale).kind, "image");
  assert.ok(trust.getPublicPlaceDescription(basePlace, locale), `${locale} public description should use only exact-locale text`);
  assert.ok(trust.getPublicTravelTip(basePlace, locale), `${locale} travel tip should use only exact-locale text`);
  assert.equal(trust.buildPlaceCardFacts(basePlace, locale).missingSummary, "");
  assert.match(trust.getLastVerifiedLabel(basePlace, locale), new RegExp(`^${locale}:2026-09-01`));
}

const unsplashPlace = {
  ...basePlace,
  thumbnail_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
};
assert.equal(trust.getPlacePhotoDisplay(unsplashPlace, "ko").kind, "placeholder");
assert.equal(trust.getTrustedPlaceImageUrl(unsplashPlace), "");
assert.match(trust.getPlacePhotoDisplay(unsplashPlace, "ko").title, /사진 준비 중/);

const noImagePlace = { ...basePlace, thumbnail_url: "" };
assert.equal(trust.getPlacePhotoDisplay(noImagePlace, "zh").kind, "placeholder");
assert.equal(trust.getTrustedPlaceImageUrl(noImagePlace), "");

const untranslatedPlace = {
  ...basePlace,
  short_description_en: "",
  short_description_ja: "",
  tips_en: "",
  tips_ja: "",
  translations: basePlace.translations.filter((item) => item.locale === "ko" || item.locale === "zh"),
};
assert.equal(trust.getPublicPlaceDescription(untranslatedPlace, "en"), "");
assert.equal(trust.getPublicPlaceDescription(untranslatedPlace, "ja"), "");
assert.equal(trust.getPublicTravelTip(untranslatedPlace, "en"), "");
assert.equal(trust.getPublicTravelTip(untranslatedPlace, "ja"), "");

const adminMemoOnly = {
  ...basePlace,
  short_description_ko: "",
  short_description_zh: "",
  translations: [],
  admin_summary: "똠양꿍 맛집",
};
assert.equal(trust.getPublicPlaceDescription(adminMemoOnly, "ko"), "");
assert.equal(trust.getPublicPlaceDescription(adminMemoOnly, "zh"), "");

const sparsePlace = {
  ...basePlace,
  thumbnail_url: "",
  opening_hours: "",
  price_min: null,
  price_max: null,
  price_level: null,
  menu_items: [],
  china_info: { verification_status: "pending", verified_at: "" },
  sources: [],
  website: "",
  last_verified_at: "",
};
const sparseFacts = trust.buildPlaceCardFacts(sparsePlace, "ko");
assert.equal(sparseFacts.facts.length, 0);
assert.equal(sparseFacts.missing.length, 5);
assert.equal(sparseFacts.missingSummary, "세부 영업정보 준비 중");
assert.equal(trust.getVerificationStatus(sparsePlace), "pending");
assert.equal(trust.getSourceSummary(sparsePlace, "ko"), "출처 확인 중");
assert.equal(trust.getLastVerifiedLabel(sparsePlace, "ko"), "확인일 준비 중");

const qualitySource = fs.readFileSync("lib/place-quality.ts", "utf8");
assert.match(qualitySource, /"visual_asset"/);
assert.match(qualitySource, /사진이 없으면 공개 화면에서 명시적 플레이스홀더/);
assert.doesNotMatch(qualitySource, /qualityItem\("thumbnail"/);

const placeCardSource = fs.readFileSync("components/PlaceCard.tsx", "utf8");
assert.match(placeCardSource, /getPlacePhotoDisplay/);
assert.match(placeCardSource, /buildPlaceCardFacts/);
assert.match(placeCardSource, /getTrustedPlaceImageUrl/);
assert.doesNotMatch(placeCardSource, /formatOpeningStatus/);
assert.doesNotMatch(placeCardSource, /getRepresentativeMenu/);

const detailSource = fs.readFileSync("app/[locale]/places/[slug]/page.tsx", "utf8");
assert.match(detailSource, /getPublicPlaceDescription/);
assert.match(detailSource, /getPublicTravelTip/);
assert.match(detailSource, /getTrustedPlaceImageUrl/);
assert.match(detailSource, /TrustFact/);

const rootDetailSource = fs.readFileSync("app/places/[slug]/page.tsx", "utf8");
assert.match(rootDetailSource, /getPublicPlaceDescription/);
assert.match(rootDetailSource, /getPublicTravelTip/);
assert.match(rootDetailSource, /getTrustedPlaceImageUrl/);
assert.match(rootDetailSource, /getPlacePhotoDisplay/);

const adminSource = fs.readFileSync("components/AdminPlaceManager.tsx", "utf8");
assert.match(adminSource, /AI 장소 요약 \(관리자 내부 메모\)/);
assert.match(adminSource, /공개 추천 설명과 분리된 내부 참고용 요약/);
assert.match(adminSource, /한국어 공개 추천 설명/);
assert.match(adminSource, /실제 사진 또는 명시적 플레이스홀더/);

const submissionSource = fs.readFileSync("components/AdminSubmissionWorkflow.tsx", "utf8");
assert.match(submissionSource, /AI 장소 요약 \(관리자 내부 메모\)/);
assert.match(submissionSource, /공개 추천 설명과 분리된 내부 참고용 요약/);
assert.match(submissionSource, /관리자 내부 메모\{form\.admin_summary\.trim\(\)/);

console.log("Place trust display tests passed (photo fallback, localized copy, verified source labels, card facts, and admin labels).");
