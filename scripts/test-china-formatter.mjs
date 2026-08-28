import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/place-china/format.ts", import.meta.url), "utf8");
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
  throw new Error(`Unexpected runtime import in formatter test: ${specifier}`);
};

new Script(outputText, { filename: "lib/place-china/format.ts" }).runInNewContext({
  module,
  exports,
  require,
  console,
});

const {
  buildChinaPlaceSummary,
  formatPaymentSummary,
  formatTasteSummary,
  formatWarnings,
  tristateLabel,
  waitingLabel,
} = module.exports;

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

console.log("China place formatter tests passed.");
