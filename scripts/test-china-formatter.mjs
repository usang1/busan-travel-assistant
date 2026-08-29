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

const mapUrl = loadTsModule("lib/map-url.ts");
const { analyzeMapLink } = loadTsModule("lib/map-link-analysis.ts", {
  "@/lib/map-url": mapUrl,
});

const naverLinkAnalysis = analyzeMapLink("https://naver.me/x9VaDLM8", [
  "https://map.naver.com/?pinId=1435915485&appMenu=location&app=Y&menu=location&lat=35.1671242&title=%EC%A7%84%EC%86%A1%EC%88%AF%EB%B6%88%20%EC%88%98%EC%98%81%EC%A0%90&pinType=site&lng=129.1170388&version=2",
  "https://map.naver.com/p/entry/place/1435915485",
]);
assert.equal(naverLinkAnalysis.provider, "NAVER");
assert.equal(naverLinkAnalysis.title, "진송숯불 수영점");
assert.equal(naverLinkAnalysis.latitude, 35.1671242);
assert.equal(naverLinkAnalysis.longitude, 129.1170388);
assert.equal(naverLinkAnalysis.externalId, "1435915485");

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
