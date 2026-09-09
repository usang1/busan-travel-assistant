import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const moduleCache = new Map();

function resolveModule(request, fromFile) {
  if (request.startsWith("@/")) {
    return path.resolve(request.replace("@/", ""));
  }

  if (request.startsWith(".")) {
    return path.resolve(path.dirname(fromFile), request);
  }

  throw new Error(`Unsupported test import: ${request}`);
}

function loadTsModule(request, fromFile = path.resolve("scripts/test-place-quality-workflow.mjs")) {
  const resolvedBase = resolveModule(request, fromFile);
  const filename = fs.existsSync(resolvedBase) ? resolvedBase : `${resolvedBase}.ts`;

  if (moduleCache.has(filename)) {
    return moduleCache.get(filename).exports;
  }

  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(filename, module);

  const localRequire = (nextRequest) => loadTsModule(nextRequest, filename);
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    require: localRequire,
    console,
    process,
    URL,
  }, { filename });

  return module.exports;
}

const { evaluatePlaceQuality } = loadTsModule("@/lib/place-quality");
const { validatePlacePayloadForSave } = loadTsModule("@/lib/place-validation");

const completePayload = {
  slug: "quality-complete-place",
  name_zh: "广安里测试店",
  name_ko: "광안리 테스트店",
  category: "restaurant",
  address: "부산 수영구 광안해변로 1",
  phone: null,
  website: "https://example.com/place",
  price_level: 2,
  status: "PUBLISHED",
  short_description_zh: "中国游客可以放心参考的测试说明。",
  short_description_ko: "공개 품질 검증을 위한 테스트 설명입니다.",
  admin_summary: "관리자 검수 완료",
  address_ko: "부산 수영구 광안해변로 1",
  address_zh: "釜山 水营区 广安海边路 1",
  latitude: 35.1532,
  longitude: 129.1186,
  closed_days: "연중무휴",
  last_verified_at: "2026-09-01",
  nearest_station: "광안역",
  nearest_exit: "3번 출구",
  walking_minutes: 8,
  price_min: 9000,
  price_max: 15000,
  opening_hours: "10:00-22:00",
  waiting_info_zh: "",
  waiting_info_ko: "",
  solo_friendly: true,
  luggage_friendly: true,
  chinese_menu: true,
  card_payment: true,
  recommended_order_zh: "招牌套餐",
  recommended_order_ko: "대표 세트",
  tips_zh: "바다 전망 좌석은 빨리 찹니다.",
  tips_ko: "바다 전망 좌석은 빨리 찹니다.",
  thumbnail_url: "https://example.com/place.jpg",
  is_featured: false,
  is_active: true,
  tags: [],
  menu_items: [
    {
      name_ko: "대표 메뉴",
      name_zh: "招牌菜单",
      description_zh: "",
      price: 9000,
      is_recommended: true,
      sort_order: 1,
    },
  ],
  translations: [
    {
      locale: "zh",
      name: "广安里测试店",
      description: "中国游客可以放心参考的测试说明。",
      travel_tip: "바다 전망 좌석은 빨리 찹니다.",
      address: "釜山 水营区 广安海边路 1",
    },
    {
      locale: "ko",
      name: "광안리 테스트店",
      description: "공개 품질 검증을 위한 테스트 설명입니다.",
      travel_tip: "바다 전망 좌석은 빨리 찹니다.",
      address: "부산 수영구 광안해변로 1",
    },
  ],
  source: {
    provider: "MANUAL",
    source_url: "https://example.com/place",
    external_id: null,
    raw_metadata: null,
    last_synced_at: "2026-09-01T00:00:00.000Z",
  },
  china_info: {
    chinese_taste_score: 4,
    spicy_level: 2,
    greasy_level: 2,
    smell_level: 2,
    portion_level: 3,
    ordering_difficulty: 2,
    waiting_level: "short",
    waiting_minutes_min: 5,
    waiting_minutes_max: 10,
    chinese_menu: "yes",
    chinese_service: "no",
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
    xiaohongshu_popular: "unknown",
    photo_recommended: "yes",
    tourism_recommended: "yes",
    subway_walk_minutes: 8,
    manual_summary_override: "중국인 여행객에게 바다 전망과 쉬운 주문이 장점입니다.",
    manual_warning_override: "피크 시간에는 창가 좌석 대기가 있을 수 있습니다.",
    traveler_insights: null,
    verification_status: "verified",
    verified_at: "2026-09-01T00:00:00.000Z",
  },
};

const completeQuality = evaluatePlaceQuality(completePayload, new Date("2026-09-07T00:00:00.000Z"));
assert.equal(completeQuality.canPublish, true);
assert.equal(completeQuality.missingRequired.length, 0);
assert.doesNotThrow(() => validatePlacePayloadForSave(completePayload));

const completeWithExplicitPlaceholder = {
  ...completePayload,
  thumbnail_url: "",
};
const placeholderQuality = evaluatePlaceQuality(completeWithExplicitPlaceholder, new Date("2026-09-07T00:00:00.000Z"));
assert.equal(placeholderQuality.canPublish, true);
assert.ok(placeholderQuality.required.some((item) => item.key === "visual_asset" && item.ok));
assert.doesNotThrow(() => validatePlacePayloadForSave(completeWithExplicitPlaceholder));

const missingDescription = {
  ...completePayload,
  short_description_zh: "",
};
const missingDescriptionQuality = evaluatePlaceQuality(missingDescription);
assert.equal(missingDescriptionQuality.canPublish, false);
assert.ok(missingDescriptionQuality.missingRequired.some((item) => item.key === "description"));
assert.throws(() => validatePlacePayloadForSave(missingDescription), /대표 설명/);

const missingCoordinates = {
  ...completePayload,
  latitude: null,
  longitude: null,
};
const missingCoordinateQuality = evaluatePlaceQuality(missingCoordinates);
assert.equal(missingCoordinateQuality.canPublish, false);
assert.ok(missingCoordinateQuality.missingRequired.some((item) => item.key === "coordinates"));
assert.throws(() => validatePlacePayloadForSave(missingCoordinates), /위도·경도/);

const draftWithoutCoordinates = {
  ...missingCoordinates,
  status: "DRAFT",
  is_active: false,
};
assert.doesNotThrow(() => validatePlacePayloadForSave(draftWithoutCoordinates));

assert.throws(() => validatePlacePayloadForSave({ ...draftWithoutCoordinates, latitude: 0, longitude: 0 }), /정상 범위/);

const staleQuality = evaluatePlaceQuality({ ...completePayload, last_verified_at: "2025-01-01" }, new Date("2026-09-07T00:00:00.000Z"));
assert.equal(staleQuality.canPublish, true);
assert.equal(staleQuality.isStale, true);
