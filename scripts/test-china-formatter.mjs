import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

function loadTsModule(path, aliases = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  const module = { exports: {} };
  const exports = module.exports;
  const require = (specifier) => {
    if (specifier in aliases) {
      return aliases[specifier];
    }

    throw new Error(`Unexpected runtime import in test for ${path}: ${specifier}`);
  };

  new Script(outputText, { filename: path }).runInNewContext({
    module,
    exports,
    require,
    console,
    process: { env: {} },
    Buffer,
    URL,
  });

  return module.exports;
}

const {
  buildChinaPlaceSummary,
  formatPaymentSummary,
  formatTasteSummary,
  formatWarnings,
  tristateLabel,
  waitingLabel,
} = loadTsModule("lib/place-china/format.ts");

const baseInfo = {
  chinese_taste_score: 4,
  spicy_level: 1,
  greasy_level: 2,
  smell_level: 1,
  portion_level: 4,
  ordering_difficulty: 2,
  waiting_level: "moderate",
  waiting_minutes_min: 10,
  waiting_minutes_max: 20,
  chinese_menu: "yes",
  foreign_card: "yes",
  alipay: "unknown",
  wechat_pay: "unknown",
  solo_friendly: "yes",
  luggage_friendly: "yes",
  toilet_available: "yes",
  reservation_required: "no",
  minimum_order_people: 1,
  minimum_order_policy: "none",
  minimum_order_note: null,
  xiaohongshu_popular: "yes",
  photo_recommended: "yes",
  tourism_recommended: "yes",
  subway_walk_minutes: 5,
  manual_summary_override: null,
  manual_warning_override: null,
  verification_status: "verified",
  verified_at: null,
};

const tasteSummary = formatTasteSummary({
  ...baseInfo,
  chinese_taste_score: null,
  spicy_level: 1,
  greasy_level: 2,
  smell_level: 1,
  portion_level: null,
  ordering_difficulty: null,
});
assert.match(tasteSummary, /整体口味比较清淡/);
assert.match(tasteSummary, /不太油腻/);
assert.match(tasteSummary, /基本不辣/);
assert.match(tasteSummary, /肉类的腥味也不明显/);

const fullSummary = buildChinaPlaceSummary({
  ...baseInfo,
  chinese_menu: "no",
  foreign_card: "yes",
  solo_friendly: "yes",
  waiting_level: "moderate",
});
assert.match(fullSummary.summary, /用餐高峰期通常需要等10~20分钟/);
assert.match(fullSummary.summary, /支持海外信用卡/);
assert.match(fullSummary.summary, /一个人也可以用餐/);
assert.match(fullSummary.summary, /目前没有确认到中文菜单/);

const mostlyUnknown = buildChinaPlaceSummary({
  ...baseInfo,
  chinese_taste_score: null,
  spicy_level: null,
  greasy_level: null,
  smell_level: null,
  portion_level: null,
  ordering_difficulty: null,
  waiting_level: "unknown",
  chinese_menu: "unknown",
  foreign_card: "unknown",
  alipay: "unknown",
  wechat_pay: "unknown",
  solo_friendly: "unknown",
  luggage_friendly: "unknown",
  toilet_available: "unknown",
  reservation_required: "unknown",
  minimum_order_people: null,
  minimum_order_policy: "unknown",
});
assert.equal(mostlyUnknown.warnings.includes("不支持海外信用卡"), false);
assert.ok(mostlyUnknown.unknownFacts.includes("海外信用卡暂未确认"));
assert.ok(mostlyUnknown.unknownFacts.includes("最低点餐限制暂未确认"));

assert.ok(formatWarnings({ ...baseInfo, foreign_card: "no" }).includes("不支持海外信用卡"));
assert.ok(formatWarnings({ ...baseInfo, spicy_level: 5 }).includes("很辣，不吃辣的人要注意"));
assert.ok(formatWarnings({ ...baseInfo, minimum_order_policy: "two_plus", minimum_order_people: 2 }).includes("通常需要2人份起点"));

const overrideSummary = buildChinaPlaceSummary({
  ...baseInfo,
  manual_summary_override: "管理员直接写的说明。",
  manual_warning_override: "管理员直接写的提醒。",
});
assert.equal(overrideSummary.summary, "管理员直接写的说明。");
assert.equal(overrideSummary.warnings[0], "管理员直接写的提醒。");

const missingSummary = buildChinaPlaceSummary({});
assert.doesNotThrow(() => buildChinaPlaceSummary(null));
assert.match(missingSummary.paymentSummary, /暂未确认/);
assert.ok(missingSummary.unknownFacts.includes("海外信用卡暂未确认"));

assert.equal(tristateLabel("yes"), "支持");
assert.equal(tristateLabel("no"), "不支持");
assert.equal(tristateLabel("unknown"), "暂未确认");
assert.equal(tristateLabel(undefined), "暂未确认");
assert.equal(waitingLabel("moderate"), "10~20分钟");
const missingPaymentSummary = formatPaymentSummary({ ...baseInfo, foreign_card: undefined });
assert.match(missingPaymentSummary, /海外信用卡/);
assert.match(missingPaymentSummary, /暂未确认/);

const discovery = loadTsModule("lib/place-china/discovery.ts", {
  "@/lib/location": {
    getOpeningStatus: () => "unknown",
  },
  "@/lib/place-china/format": {
    buildChinaPlaceSummary,
  },
});

const providerDetection = loadTsModule("lib/place-providers/detect.ts");
const mapUrl = loadTsModule("lib/map-url.ts", {
  "@/lib/place-providers/detect": providerDetection,
});
const providerNormalize = loadTsModule("lib/place-providers/normalize.ts", {
  "@/lib/map-url": mapUrl,
});
const { analyzeMapLink } = loadTsModule("lib/map-link-analysis.ts", {
  "@/lib/map-url": mapUrl,
});
const mapUrlResolver = loadTsModule("lib/map-url-resolver.ts", {
  "@/lib/map-link-analysis": { analyzeMapLink },
  "@/lib/map-url": mapUrl,
  "@/lib/place-providers/detect": providerDetection,
  "@/lib/place-providers/normalize": providerNormalize,
  "@/lib/place-providers/nearest-station": { resolveNearestStation: async () => null },
  "@/lib/place-providers/registry": {
    getPlaceProvider: (provider) => ({ id: provider, lookup: async () => null }),
  },
});
const mapSource = loadTsModule("lib/place-ai/map-source.ts", {
  "@/lib/map-url": mapUrl,
});
const placeAiTypes = {};
const localeValidation = loadTsModule("lib/place-ai/locale-validation.ts");
const databaseRuntime = {
  placeCategories: ["restaurant", "cafe", "bar", "attraction", "shopping", "photo_spot", "luggage"],
};
const contentDraft = loadTsModule("lib/place-ai/content-draft.ts", {
  "@/types/place-ai": placeAiTypes,
  "@/types/database": databaseRuntime,
  "@/lib/place-ai/map-source": mapSource,
});
const generator = loadTsModule("lib/place-ai/generator.ts", {
  openai: { default: class OpenAI {} },
  "@/lib/place-ai/map-source": mapSource,
  "@/lib/place-ai/content-draft": contentDraft,
  "@/lib/place-ai/locale-validation": localeValidation,
  "@/types/place-ai": placeAiTypes,
  "@/types/database": databaseRuntime,
});
const { buildAdminTranslationPrompt, buildPlaceSummaryPrompt, parseAdminTranslationFields } = loadTsModule("lib/openai-place-summary.ts", {
  "@/lib/place-ai/locale-validation": localeValidation,
});

const naverLinkAnalysis = analyzeMapLink("https://naver.me/x9VaDLM8", [
  "https://map.naver.com/?pinId=1435915485&appMenu=location&app=Y&menu=location&lat=35.1671242&title=%EC%A7%84%EC%86%A1%EC%88%AF%EB%B6%88%20%EC%88%98%EC%98%81%EC%A0%90&pinType=site&lng=129.1170388&version=2",
  "https://map.naver.com/p/entry/place/1435915485",
]);
assert.equal(naverLinkAnalysis.provider, "naver");
assert.equal(naverLinkAnalysis.sourceProvider, "NAVER");
assert.equal(naverLinkAnalysis.title, "진송숯불 수영점");
assert.equal(naverLinkAnalysis.latitude, 35.1671242);
assert.equal(naverLinkAnalysis.longitude, 129.1170388);
assert.equal(naverLinkAnalysis.externalId, "1435915485");
assert.equal(naverLinkAnalysis.coordinateSource, "query");
assert.equal(naverLinkAnalysis.confidence, "high");
const naverCenterAnalysis = analyzeMapLink("https://map.naver.com/p/search/test?c=129.1170388,35.1671242,15,0,0,0,dh");
assert.equal(naverCenterAnalysis.latitude, 35.1671242);
assert.equal(naverCenterAnalysis.longitude, 129.1170388);
assert.equal(naverCenterAnalysis.coordinateSource, "naver-center");
const naverPlaceAnalysis = analyzeMapLink("https://place.naver.com/restaurant/1435915485/home");
assert.equal(naverPlaceAnalysis.provider, "naver");
assert.equal(naverPlaceAnalysis.placeId, "1435915485");
assert.equal(naverPlaceAnalysis.failureReason, "no_coordinates");
const naverSwappedAnalysis = analyzeMapLink("https://map.naver.com/p/search/test?c=129.1170388,35.1671242,15z");
assert.equal(naverSwappedAnalysis.latitude, 35.1671242);
assert.equal(naverSwappedAnalysis.longitude, 129.1170388);
const kakaoPlaceAnalysis = analyzeMapLink("https://place.map.kakao.com/12345");
assert.equal(kakaoPlaceAnalysis.provider, "kakao");
assert.equal(kakaoPlaceAnalysis.placeId, "12345");
const kakaoLinkAnalysis = analyzeMapLink("https://map.kakao.com/link/map/%EA%B4%91%EC%95%88%EB%A6%AC,35.1532,129.1186");
assert.equal(kakaoLinkAnalysis.latitude, 35.1532);
assert.equal(kakaoLinkAnalysis.longitude, 129.1186);
assert.equal(kakaoLinkAnalysis.coordinateSource, "kakao-link");
const googlePathAnalysis = analyzeMapLink("https://www.google.com/maps/place/test/@35.1671242,129.1170388,17z/data=!3d35.1671242!4d129.1170388");
assert.equal(googlePathAnalysis.provider, "google");
assert.equal(googlePathAnalysis.latitude, 35.1671242);
assert.equal(googlePathAnalysis.longitude, 129.1170388);
assert.equal(googlePathAnalysis.coordinateSource, "google-at-path");
const googleDataAnalysis = analyzeMapLink("https://www.google.com/maps/place/test/data=!3d35.1671242!4d129.1170388");
assert.equal(googleDataAnalysis.latitude, 35.1671242);
assert.equal(googleDataAnalysis.longitude, 129.1170388);
assert.equal(googleDataAnalysis.coordinateSource, "google-data");
const googleShortAnalysis = analyzeMapLink("https://maps.app.goo.gl/abc");
assert.equal(googleShortAnalysis.provider, "google");
assert.equal(googleShortAnalysis.failureReason, "no_coordinates");
assert.equal(mapUrl.parseMapUrl("not a url").provider, "unknown");
assert.equal(mapUrl.parseMapUrl("https://example.com/maps/@35.1,129.1").provider, "unknown");
assert.equal(mapUrl.parseMapUrl("https://map.naver.com/p/entry/place/1435915485").failureReason, "no_coordinates");

const googleResolved = await mapUrlResolver.resolveMapUrl("https://maps.app.goo.gl/abc", async (url) => ({
  status: url.toString().includes("maps.app.goo.gl") ? 302 : 200,
  headers: {
    get: (name) =>
      name.toLowerCase() === "location" && url.toString().includes("maps.app.goo.gl")
        ? "https://www.google.com/maps/place/test/@35.1671242,129.1170388,17z"
        : "",
  },
  bodyUsed: false,
  text: async () => "",
}));
assert.equal(googleResolved.provider, "google");
assert.equal(googleResolved.resolvedUrl, "https://www.google.com/maps/place/test/@35.1671242,129.1170388,17z");
assert.equal(googleResolved.latitude, 35.1671242);
assert.equal(googleResolved.longitude, 129.1170388);

const naverResolved = await mapUrlResolver.resolveMapUrl("https://naver.me/x9VaDLM8", async (url) => ({
  status: url.toString().includes("naver.me") ? 302 : 200,
  headers: {
    get: (name) =>
      name.toLowerCase() === "location" && url.toString().includes("naver.me")
        ? "https://map.naver.com/?pinId=1435915485&lat=35.1671242&lng=129.1170388"
        : "",
  },
  bodyUsed: false,
  text: async () => "",
}));
assert.equal(naverResolved.provider, "naver");
assert.equal(naverResolved.placeId, "1435915485");
assert.equal(naverResolved.latitude, 35.1671242);
assert.equal(naverResolved.longitude, 129.1170388);

await assert.rejects(
  () =>
    mapUrlResolver.resolveMapUrl("https://example.com/maps/@35.1,129.1", async () => ({
      status: 200,
      headers: { get: () => "" },
      bodyUsed: false,
      text: async () => "",
    })),
  /네이버\/카카오\/구글 지도 링크/,
);
const summaryPrompt = buildPlaceSummaryPrompt(naverLinkAnalysis);
assert.match(summaryPrompt, /진송숯불 수영점/);
assert.match(summaryPrompt, /맛, 가격, 영업시간, 웨이팅, 결제, 메뉴, 리뷰 수는 제공되지 않으면 쓰지 말 것/);
const translationPrompt = buildAdminTranslationPrompt({
  name_ko: "진송숯불 수영점",
  name_zh: "",
  name_en: "",
  description_ko: "수영역 근처 숯불구이 식당",
});
assert.match(translationPrompt, /한국어\/중국어 간체\/영어\/일본어/);
assert.match(translationPrompt, /과장 문구는 직역하지 말고/);
assert.match(translationPrompt, /진송숯불 수영점/);

const multilingualJson = JSON.stringify({
  description: {
    ko: "광안리 해변 인근의 카페입니다.",
    zh: "这是一家位于广安里海边附近的咖啡馆。",
    en: "This cafe is near Gwangalli Beach.",
    ja: "広安里ビーチ近くのカフェです。",
  },
  travel_tip: {
    ko: "광안역에서 이동할 수 있습니다.",
    zh: "可从广安站前往。",
    en: "It is accessible from Gwangan Station.",
    ja: "広安駅からアクセスできます。",
  },
});
const multilingual = generator.parseAndValidateGeneratedContent(multilingualJson);
assert.equal(multilingual.localeResults.ko.status, "generated");
assert.equal(multilingual.localeResults.zh.status, "generated");
assert.equal(multilingual.localeResults.en.status, "generated");
assert.equal(multilingual.localeResults.ja.status, "generated");
assert.equal(multilingual.content.travel_tip_ja, "広安駅からアクセスできます。");

const japaneseFailure = generator.parseAndValidateGeneratedContent(JSON.stringify({
  description: { ko: "광안리 카페입니다.", zh: "这是广安里的咖啡馆。", en: "This is a cafe in Gwangalli.", ja: "광안리 카페입니다." },
  travel_tip: { ko: "광안역에서 가깝습니다.", zh: "距离广安站较近。", en: "It is close to Gwangan Station.", ja: "광안역에서 가깝습니다." },
}));
assert.equal(japaneseFailure.localeResults.ja.status, "failed");
assert.equal(japaneseFailure.content.description_ja, "");
assert.equal(japaneseFailure.localeResults.en.status, "generated");

const chineseFailure = generator.parseAndValidateGeneratedContent(JSON.stringify({
  description: { ko: "광안리 카페입니다.", zh: "광안리 카페입니다.", en: "This is a cafe in Gwangalli.", ja: "広安里のカフェです。" },
  travel_tip: { ko: "광안역에서 가깝습니다.", zh: "광안역에서 가깝습니다.", en: "It is close to Gwangan Station.", ja: "広安駅から近いです。" },
}));
assert.equal(chineseFailure.localeResults.zh.status, "failed");
assert.equal(chineseFailure.localeResults.ja.status, "generated");

assert.equal(localeValidation.sanitizeLocalizedAddress("부산 수영구 광안해변로 219", "부산 수영구 광안해변로 219", "zh"), "");
assert.equal(localeValidation.sanitizeLocalizedAddress("釜山广域市水营区广安海边路219", "부산 수영구 광안해변로 219", "zh"), "釜山广域市水营区广安海边路219");
assert.equal(localeValidation.sanitizeLocalizedAddress("Busan, Suyeong-gu, Gwanganhaebyeon-ro", "부산 수영구 광안해변로 219", "en"), "");
assert.equal(localeValidation.sanitizeLocalizedAddress("219 Gwanganhaebyeon-ro, Suyeong-gu, Busan", "부산 수영구 광안해변로 219", "en"), "219 Gwanganhaebyeon-ro, Suyeong-gu, Busan");

const translatedFields = parseAdminTranslationFields({ output_text: JSON.stringify({
  name_ko: "진송숯불 수영점", name_zh: "真松炭火水营店", name_en: "Jinsong Charcoal Suyeong", name_ja: "ジンソン炭火焼き 水営店",
  short_description_ko: "수영구의 숯불구이 식당입니다.", short_description_zh: "位于水营区的炭火烤肉店。", short_description_en: "A charcoal grill restaurant in Suyeong-gu.", short_description_ja: "水営区にある炭火焼き店です。",
  description_ko: "수영구의 숯불구이 식당입니다.", description_zh: "位于水营区的炭火烤肉店。", description_en: "A charcoal grill restaurant in Suyeong-gu.", description_ja: "水営区にある炭火焼き店です。",
  tips_ko: "수영역에서 이동할 수 있습니다.", tips_zh: "可从水营站前往。", tips_en: "It is accessible from Suyeong Station.", tips_ja: "水営駅からアクセスできます。",
  recommended_order_ko: "", recommended_order_zh: "",
  address_ko: "부산 수영구 수영로 219", address_zh: "釜山市水营区水营路219", address_en: "219 Suyeong-ro, Suyeong-gu, Busan", address_ja: "釜山市水営区水営路219",
}) }, { address_ko: "부산 수영구 수영로 219" });
assert.equal(translatedFields.translations.address_zh, "釜山市水营区水营路219");
assert.equal(translatedFields.translations.address_ja, "釜山市水営区水営路219");
assert.equal(translatedFields.failed_fields.length, 0);

const sourceWithNoMemo = contentDraft.buildPlaceSourceData({
  slug: "memo-test", name_zh: "测试", name_ko: "테스트", category: "cafe", address_ko: "부산 수영구 219", address_zh: "", latitude: 35.15, longitude: 129.11,
  nearest_station: "", nearest_exit: "", walking_minutes: 0, price_min: null, price_max: null, opening_hours: "", waiting_info_zh: "", waiting_info_ko: "",
  solo_friendly: false, luggage_friendly: false, chinese_menu: false, card_payment: false, recommended_order_zh: "", recommended_order_ko: "", tips_zh: "", tips_ko: "",
  short_description_zh: "", short_description_ko: "", thumbnail_url: "", is_featured: false, is_active: true, status: "ACTIVE", tags: [], menu_items: [],
});
assert.equal(sourceWithNoMemo.admin_notes, "");
const hypePrompt = generator.buildUserPrompt(JSON.stringify({ ...sourceWithNoMemo, admin_notes: "부산 느좋 카페 1등" }), ["ko", "zh", "en", "ja"]);
assert.match(hypePrompt, /부산 느좋 카페 1등/);
assert.equal(mapSource.analyzePlaceMapSource("https://map.naver.com/p/entry/place/1435915485").source_type, "naver");
assert.equal(mapSource.analyzePlaceMapSource("https://place.map.kakao.com/12345").external_id, "12345");
assert.equal(mapSource.analyzePlaceMapSource("https://maps.google.com/?cid=999").source_type, "google");
assert.equal(mapSource.analyzePlaceMapSource("not a url").source_type, "unknown");

assert.throws(
  () =>
    generator.normalizePlaceAiGenerationRequest({
      sourceData: {
        name: "장소명만 있음",
        category: "restaurant",
      },
    }),
  /최소한의 장소 정보/,
);

await assert.rejects(
  () =>
    generator.generatePlaceAiContent({
      source_data: contentDraft.buildPlaceSourceData({
        slug: "sample",
        name_zh: "样本餐厅",
        name_ko: "샘플 식당",
        category: "restaurant",
        address_ko: "부산 수영구",
        address_zh: "釜山 水营区",
        latitude: 35.15,
        longitude: 129.11,
        nearest_station: "광안역",
        nearest_exit: "",
        walking_minutes: 5,
        price_min: 10000,
        price_max: 20000,
        opening_hours: "10:00-22:00",
        waiting_info_zh: "",
        waiting_info_ko: "",
        solo_friendly: true,
        luggage_friendly: false,
        chinese_menu: false,
        card_payment: true,
        recommended_order_zh: "",
        recommended_order_ko: "",
        tips_zh: "",
        tips_ko: "",
        short_description_zh: "",
        short_description_ko: "",
        thumbnail_url: "",
        is_featured: false,
        is_active: true,
        status: "ACTIVE",
        tags: [],
        menu_items: [],
      }),
      locale_targets: ["ko", "zh", "en", "ja"],
    }),
  /OPENAI_API_KEY/,
);

const {
  filterPlacesForChineseTraveler,
  getChinaDiscoveryTags,
  getChinaRecommendationLabel,
  sortPlacesForChineseTraveler,
} = discovery;

const makePlace = (id, chinaInfo, priceMax = 12000, openingHours = "10:00-22:00") => ({
  id,
  slug: id,
  name_zh: id,
  name_ko: id,
  category: "restaurant",
  address_ko: "부산 수영구 광안동",
  address_zh: "釜山 水营区",
  short_description_zh: "",
  short_description_ko: "",
  latitude: 35.15,
  longitude: 129.11,
  nearest_station: "광안역",
  nearest_exit: "3번 출구",
  walking_minutes: 5,
  price_min: 9000,
  price_max: priceMax,
  opening_hours: openingHours,
  waiting_info_zh: "",
  waiting_info_ko: "",
  solo_friendly: false,
  luggage_friendly: false,
  chinese_menu: false,
  card_payment: false,
  recommended_order_zh: "",
  recommended_order_ko: "",
  tips_zh: "",
  tips_ko: "",
  thumbnail_url: "",
  is_featured: false,
  is_active: true,
  created_at: "",
  updated_at: "",
  tags: [],
  menu_items: [],
  china_info: chinaInfo,
  save_count: 0,
});

const easyPlace = makePlace("easy", {
  ...baseInfo,
  chinese_taste_score: 5,
  spicy_level: 1,
  waiting_level: "short",
  foreign_card: "yes",
  solo_friendly: "yes",
  luggage_friendly: "yes",
  subway_walk_minutes: 4,
});
const strictPlace = makePlace(
  "strict",
  {
    ...baseInfo,
    chinese_taste_score: 2,
    spicy_level: 5,
    waiting_level: "long",
    foreign_card: "no",
    solo_friendly: "no",
    luggage_friendly: "no",
    xiaohongshu_popular: "unknown",
    subway_walk_minutes: 9,
  },
  28000,
  "11:00-20:00",
);
const unknownPlace = makePlace("unknown", {
  ...baseInfo,
  chinese_taste_score: null,
  spicy_level: null,
  waiting_level: "unknown",
  foreign_card: "unknown",
  solo_friendly: "unknown",
  luggage_friendly: "unknown",
  xiaohongshu_popular: "unknown",
});
const discoveryPlaces = [strictPlace, unknownPlace, easyPlace];

assert.deepEqual(filterPlacesForChineseTraveler(discoveryPlaces, ["foreignCard"]).map((place) => place.id), ["easy"]);
assert.deepEqual(filterPlacesForChineseTraveler(discoveryPlaces, ["solo", "nonSpicy"]).map((place) => place.id), ["easy"]);
assert.deepEqual(filterPlacesForChineseTraveler(discoveryPlaces, ["lowWait"]).map((place) => place.id), ["easy"]);
assert.deepEqual(filterPlacesForChineseTraveler(discoveryPlaces, ["openNight"]).map((place) => place.id), ["unknown", "easy"]);
assert.deepEqual(filterPlacesForChineseTraveler(discoveryPlaces, ["foreignCard"], "low").map((place) => place.id), []);
assert.equal(getChinaRecommendationLabel(easyPlace), "5/5");
assert.equal(getChinaRecommendationLabel(unknownPlace), "暂未确认");
assert.ok(getChinaDiscoveryTags(easyPlace, "zh", 4).includes("不辣"));
assert.deepEqual(sortPlacesForChineseTraveler(discoveryPlaces.map((place, index) => ({ place, distance: index })), "chinaRecommended")[0].place.id, "easy");
assert.deepEqual(sortPlacesForChineseTraveler(discoveryPlaces.map((place, index) => ({ place, distance: index })), "lowWait")[0].place.id, "easy");

console.log("China place formatter and discovery tests passed.");
