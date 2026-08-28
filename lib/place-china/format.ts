import type { ChinaWaitingLevel, PlaceChinaInfoPayload, PlaceChinaInfoRecord, PlaceFactTristate } from "@/types/database";

export type ChinaPlaceInfoInput = PlaceChinaInfoPayload | PlaceChinaInfoRecord | null | undefined;

export type ChinaRatingKey =
  | "chinese_taste_score"
  | "spicy_level"
  | "greasy_level"
  | "smell_level"
  | "portion_level"
  | "ordering_difficulty";

export type ChinaRatingDisplay = {
  key: ChinaRatingKey;
  label: string;
  value: number | null;
  zhLabel: string;
  koHelp: string;
};

export type ChinaPlaceSummary = {
  summary: string;
  warnings: string[];
  tags: string[];
  ratings: ChinaRatingDisplay[];
  paymentSummary: string;
  convenienceSummary: string;
  waitingSummary: string;
};

export const unknownText = "暂未确认";

export const ratingHelp: Record<ChinaRatingKey, { label: string; values: Record<number, { zh: string; ko: string }> }> = {
  chinese_taste_score: {
    label: "中国游客推荐度",
    values: {
      1: { zh: "不太推荐", ko: "중국인에게 추천도 낮음" },
      2: { zh: "一般", ko: "호불호 있음" },
      3: { zh: "可以考虑", ko: "무난함" },
      4: { zh: "比较推荐", ko: "추천하는 편" },
      5: { zh: "很推荐", ko: "강력 추천" },
    },
  },
  spicy_level: {
    label: "辣度",
    values: {
      1: { zh: "基本不辣", ko: "전혀 안 매움" },
      2: { zh: "微辣", ko: "거의 안 매움" },
      3: { zh: "中等辣度", ko: "보통" },
      4: { zh: "比较辣", ko: "매움" },
      5: { zh: "很辣", ko: "매우 매움" },
    },
  },
  greasy_level: {
    label: "油腻度",
    values: {
      1: { zh: "很清爽", ko: "매우 담백" },
      2: { zh: "比较清淡", ko: "담백한 편" },
      3: { zh: "适中", ko: "보통" },
      4: { zh: "比较油腻", ko: "느끼한 편" },
      5: { zh: "很油腻", ko: "매우 느끼함" },
    },
  },
  smell_level: {
    label: "气味",
    values: {
      1: { zh: "几乎没有明显腥味", ko: "거의 없음" },
      2: { zh: "腥味较轻", ko: "약함" },
      3: { zh: "能感觉到一些特殊气味", ko: "조금 느껴짐" },
      4: { zh: "气味比较明显", ko: "강함" },
      5: { zh: "对气味敏感的人可能不太适合", ko: "매우 강함" },
    },
  },
  portion_level: {
    label: "份量",
    values: {
      1: { zh: "份量偏少", ko: "양이 적음" },
      2: { zh: "份量稍少", ko: "조금 적음" },
      3: { zh: "份量适中", ko: "보통" },
      4: { zh: "份量比较足", ko: "넉넉한 편" },
      5: { zh: "份量很足", ko: "매우 넉넉함" },
    },
  },
  ordering_difficulty: {
    label: "点餐难度",
    values: {
      1: { zh: "点餐很容易", ko: "매우 쉬움" },
      2: { zh: "比较容易", ko: "쉬움" },
      3: { zh: "普通", ko: "보통" },
      4: { zh: "需要一点准备", ko: "어려움" },
      5: { zh: "外国人点餐可能比较难", ko: "외국인이 주문하기 매우 어려움" },
    },
  },
};

const ratingKeys: ChinaRatingKey[] = [
  "chinese_taste_score",
  "spicy_level",
  "greasy_level",
  "smell_level",
  "portion_level",
  "ordering_difficulty",
];

export function buildChinaPlaceSummary(info: ChinaPlaceInfoInput): ChinaPlaceSummary {
  const ratings = formatRatingDisplays(info);
  const summary = info?.manual_summary_override?.trim() || formatTasteSummary(info);
  const automaticWarnings = formatWarnings(info);
  const manualWarning = info?.manual_warning_override?.trim();
  const warnings = manualWarning ? [manualWarning, ...automaticWarnings] : automaticWarnings;
  const paymentSummary = formatPaymentSummary(info);
  const convenienceSummary = formatConvenienceSummary(info);
  const waitingSummary = formatWaitingSummary(info);

  return {
    summary,
    warnings,
    tags: buildChinaPlaceTags(info),
    ratings,
    paymentSummary,
    convenienceSummary,
    waitingSummary,
  };
}

export function formatRatingDisplays(info: ChinaPlaceInfoInput): ChinaRatingDisplay[] {
  return ratingKeys.map((key) => {
    const value = normalizeScore(info?.[key]);
    const help = value ? ratingHelp[key].values[value] : null;

    return {
      key,
      label: ratingHelp[key].label,
      value,
      zhLabel: help?.zh ?? unknownText,
      koHelp: help?.ko ?? "확인 필요",
    };
  });
}

export function formatTasteSummary(info: ChinaPlaceInfoInput) {
  if (!info) {
    return "这家店的中国游客适配信息还在确认中。";
  }

  const parts = [
    scoreLabel(info.chinese_taste_score, "整体对中国游客来说可以考虑", "整体比较推荐给中国游客", "整体很适合中国游客"),
    tastePhrase(info.spicy_level, "spicy_level"),
    tastePhrase(info.greasy_level, "greasy_level"),
    tastePhrase(info.smell_level, "smell_level"),
    tastePhrase(info.portion_level, "portion_level"),
    tastePhrase(info.ordering_difficulty, "ordering_difficulty"),
  ].filter(Boolean);

  if (parts.length === 0) {
    return "这家店的口味、份量和点餐难度还在确认中。";
  }

  return `${parts.join("，")}。`;
}

export function formatWaitingSummary(info: ChinaPlaceInfoInput) {
  if (!info || info.waiting_level === "unknown") {
    return "等位情况暂未确认。";
  }

  const label = waitingLabel(info.waiting_level);

  if (info.waiting_level === "none") {
    return "通常不太需要排队。";
  }

  if (info.waiting_level === "varies") {
    return "等位时间会随时段变化，建议高峰期提前确认。";
  }

  return `高峰期通常需要等${label}。`;
}

export function formatPaymentSummary(info: ChinaPlaceInfoInput) {
  const items = [
    tristatePhrase("海外信用卡", info?.foreign_card),
    tristatePhrase("支付宝", info?.alipay),
    tristatePhrase("微信支付", info?.wechat_pay),
  ];

  return items.join("，");
}

export function formatConvenienceSummary(info: ChinaPlaceInfoInput) {
  const items = [
    tristatePhrase("中文菜单", info?.chinese_menu),
    tristatePhrase("一个人用餐", info?.solo_friendly),
    tristatePhrase("带行李箱", info?.luggage_friendly),
    tristatePhrase("店内厕所", info?.toilet_available),
  ];

  return items.join("，");
}

export function formatWarnings(info: ChinaPlaceInfoInput) {
  if (!info) {
    return ["中国游客适配信息暂未确认"];
  }

  const warnings: string[] = [];

  if (info.chinese_menu === "no") warnings.push("目前没有中文菜单");
  if (info.foreign_card === "no") warnings.push("不支持海外信用卡");
  if (info.luggage_friendly === "no") warnings.push("带大行李箱可能不方便");
  if (info.reservation_required === "yes") warnings.push("建议提前预约");
  if (info.minimum_order_policy === "two_plus") warnings.push("通常需要2人份起点");
  if (info.minimum_order_policy === "three_plus") warnings.push("通常需要3人份起点");
  if (info.minimum_order_policy === "other") warnings.push(info.minimum_order_note?.trim() || "有最低点餐限制");
  if ((info.spicy_level ?? 0) >= 5) warnings.push("辣度较高，不吃辣的人要注意");
  if ((info.smell_level ?? 0) >= 4) warnings.push("气味比较明显，对气味敏感的人要注意");
  if (info.waiting_level === "long") warnings.push("高峰期可能需要等20~40分钟");
  if (info.waiting_level === "extreme") warnings.push("高峰期可能需要等40分钟以上");

  return warnings.length ? warnings : ["暂未发现特别需要注意的事项"];
}

export function buildChinaPlaceTags(info: ChinaPlaceInfoInput) {
  const tags: string[] = [];

  if (!info) {
    return ["信息确认中"];
  }

  if ((info.chinese_taste_score ?? 0) >= 4) tags.push("中国游客推荐");
  if ((info.spicy_level ?? 0) <= 2 && info.spicy_level) tags.push("不太辣");
  if ((info.ordering_difficulty ?? 0) <= 2 && info.ordering_difficulty) tags.push("点餐容易");
  if (info.chinese_menu === "yes") tags.push("中文菜单");
  if (info.foreign_card === "yes") tags.push("海外卡OK");
  if (info.alipay === "yes") tags.push("支付宝");
  if (info.wechat_pay === "yes") tags.push("微信支付");
  if (info.solo_friendly === "yes") tags.push("一人OK");
  if (info.luggage_friendly === "yes") tags.push("行李箱OK");
  if (info.waiting_level === "none" || info.waiting_level === "short") tags.push("排队少");
  if (info.xiaohongshu_popular === "yes") tags.push("小红书热门");
  if (info.photo_recommended === "yes") tags.push("适合拍照");
  if (info.tourism_recommended === "yes") tags.push("适合观光");

  return tags.slice(0, 8);
}

export function tristateLabel(value: PlaceFactTristate | null | undefined) {
  if (value === "yes") return "支持";
  if (value === "no") return "不支持";
  return unknownText;
}

export function waitingLabel(value: ChinaWaitingLevel | null | undefined) {
  return {
    unknown: unknownText,
    none: "几乎不用等",
    short: "5~10分钟",
    moderate: "10~20分钟",
    long: "20~40分钟",
    extreme: "40分钟以上",
    varies: "随时段变化",
  }[value ?? "unknown"];
}

function scoreLabel(value: number | null | undefined, normal: string, high: string, top: string) {
  if (!value) return "";
  if (value >= 5) return top;
  if (value >= 4) return high;
  return normal;
}

function tastePhrase(value: number | null | undefined, key: Exclude<ChinaRatingKey, "chinese_taste_score">) {
  const score = normalizeScore(value);

  if (!score) {
    return "";
  }

  return ratingHelp[key].values[score].zh;
}

function tristatePhrase(label: string, value: PlaceFactTristate | null | undefined) {
  return `${label}${tristateLabel(value)}`;
}

function normalizeScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) {
    return null;
  }

  return Math.round(value);
}
