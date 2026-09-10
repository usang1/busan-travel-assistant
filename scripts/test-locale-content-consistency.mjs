import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compileTs(path, requireHandler, globals = {}) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  const module = { exports: {} };

  vm.runInNewContext(
    compiled,
    {
      exports: module.exports,
      module,
      require: requireHandler,
      console,
      URL,
      Intl,
      process: { env: { NODE_ENV: "test" } },
      ...globals,
    },
    { filename: path },
  );

  return module.exports;
}

const i18n = compileTs("lib/i18n.ts", (specifier) => {
  if (specifier === "@/config/site") {
    return {
      absoluteUrl: (path) => `https://example.com${path}`,
    };
  }

  throw new Error(`Unexpected i18n import: ${specifier}`);
});

assert.equal(JSON.stringify(i18n.getLocaleDictionaryKeyDiffs()), "[]", "KO/ZH/EN/JA dictionaries must have the same nested keys");

const place = {
  name_ko: "광안리 카페",
  name_zh: "广安里咖啡",
  short_description_ko: "한국어 공개 설명입니다.",
  short_description_zh: "中文公开说明。",
  tips_ko: "한국어 여행 팁입니다.",
  tips_zh: "中文旅行提示。",
  waiting_info_ko: "한국어 대기 정보",
  waiting_info_zh: "中文等位信息",
  recommended_order_ko: "한국어 주문 문장",
  recommended_order_zh: "中文点单句",
  address_ko: "부산 수영구",
  address_zh: "釜山水营区",
  translations: [
    { locale: "en", name: "Gwangalli Cafe", description: "", travel_tip: "", address: "Suyeong-gu, Busan" },
    { locale: "ja", name: "広安里カフェ", description: "", travel_tip: "", address: "釜山水営区" },
  ],
};

assert.equal(i18n.getPlaceContent(place, "en").name, "Gwangalli Cafe");
assert.equal(i18n.getPlaceContent(place, "en").description, "");
assert.equal(i18n.getPlaceContent(place, "ja").travelTip, "");
assert.equal(i18n.getPlaceContent(place, "en").waitingInfo, "");
assert.equal(i18n.getPlaceContent(place, "ko").waitingInfo, "한국어 대기 정보");
assert.equal(i18n.getLocalizedTag({ label_zh: "海景", label_ko: "바다 전망" }, "en"), "");
assert.equal(i18n.getLocalizedTag({ label_zh: "海景", label_ko: "바다 전망" }, "ja"), "");

const categoryLabels = {
  restaurant: { zh: "餐厅", en: "Restaurants", ja: "飲食店", ko: "음식점" },
  cafe: { zh: "咖啡", en: "Cafes", ja: "カフェ", ko: "카페" },
  bar: { zh: "酒吧", en: "Bars", ja: "バー", ko: "술집" },
  attraction: { zh: "景点", en: "Attractions", ja: "観光", ko: "관광" },
  shopping: { zh: "购物", en: "Shopping", ja: "ショッピング", ko: "쇼핑" },
  photo_spot: { zh: "拍照", en: "Photo spots", ja: "写真スポット", ko: "사진" },
  luggage: { zh: "行李寄存", en: "Luggage", ja: "荷物預かり", ko: "짐보관" },
};

const trust = compileTs("lib/place-trust.ts", (specifier) => {
  if (specifier === "@/lib/i18n") {
    return {
      getLocalizedMenuItem: (item, locale) => ({
        name: locale === "zh" ? item.name_zh : locale === "ko" ? item.name_ko : "",
        secondaryName: "",
      }),
      getPlaceContent: i18n.getPlaceContent,
    };
  }

  if (specifier === "@/lib/traveler-insights") {
    return { verificationDateLabel: (value, locale) => value ? `${locale}:${value}` : "" };
  }

  if (specifier === "@/types/database") {
    return { categoryLabels };
  }

  throw new Error(`Unexpected trust import: ${specifier}`);
});

assert.equal(trust.getPlaceCategoryLabel("restaurant", "en"), "Restaurants");
assert.equal(trust.getPlaceCategoryLabel("restaurant", "zh"), "餐厅");
assert.equal(JSON.stringify(trust.getLocalizedRecommendationDisplay({ china_info: {} }, "ja")), JSON.stringify({ label: "おすすめ度", value: "未確認" }));
assert.equal(trust.getPlaceNameDisplay(place, "en").secondaryLabel, "Korean original name");

const display = compileTs("lib/place-display.ts", (specifier) => {
  if (specifier === "@/lib/location") {
    return {
      formatDistance: () => "",
      gwangalliCenter: { latitude: 35.153, longitude: 129.118 },
      calculateDistanceMeters: () => 0,
      hasCoordinates: () => false,
    };
  }

  if (specifier === "@/lib/place-china/format") {
    return {
      buildChinaPlaceSummary: () => ({ tags: ["信息确认中"], summary: "管理员直接写的说明。" }),
      waitingLabel: () => "等位情况暂未确认",
    };
  }

  if (specifier === "@/lib/place-store") {
    return {
      formatPriceRange: () => "",
      formatWon: (value) => `₩${value}`,
    };
  }

  if (specifier === "@/lib/i18n") {
    return i18n;
  }

  throw new Error(`Unexpected display import: ${specifier}`);
});

assert.equal(display.getTravelerAdvantage({ china_info: { manual_summary_override: "존맛탱" } }, "en"), i18n.ui.en.common.noInfo);
assert.equal(display.getTravelerAdvantage({ china_info: { manual_summary_override: "존맛탱" } }, "ja"), i18n.ui.ja.common.noInfo);

const discoverySource = fs.readFileSync("lib/place-china/discovery.ts", "utf8");
const nearbySource = fs.readFileSync("components/NearbyExplorer.tsx", "utf8");
const travelMapSource = fs.readFileSync("components/TravelMap.tsx", "utf8");
const placeCardSource = fs.readFileSync("components/PlaceCard.tsx", "utf8");
const savedSource = fs.readFileSync("components/SavedItemsView.tsx", "utf8");
const tripMapSource = fs.readFileSync("components/TripDayMap.tsx", "utf8");

assert.match(discoverySource, /if \(locale !== "zh"\) \{\s*return \[\];\s*\}/);
assert.match(nearbySource, /getLocalizedRecommendationDisplay/);
assert.doesNotMatch(nearbySource, /推荐度 \{getChinaRecommendationLabel|推荐度 \{recommendation|收藏 \{/);
assert.doesNotMatch(travelMapSource, /推荐度 \$\{marker\.recommendation\}/);
assert.match(placeCardSource, /getPlaceCategoryLabel/);
assert.match(savedSource, /getPlaceCategoryLabel/);
assert.match(tripMapSource, /getPlaceCategoryLabel/);

console.log("Locale content consistency tests passed (dictionary parity, exact-locale content, localized map/card formatters).");
