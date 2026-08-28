import type {
  ChinaMinimumOrderPolicy,
  ChinaWaitingLevel,
  PlaceChinaInfoPayload,
  PlaceChinaInfoRecord,
  PlaceFactTristate,
} from "@/types/database";

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
  unknownFacts: string[];
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
      3: { zh: "辣度适中", ko: "보통" },
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
      1: { zh: "份量较少", ko: "양이 적음" },
      2: { zh: "份量偏少", ko: "조금 적음" },
      3: { zh: "份量适中", ko: "보통" },
      4: { zh: "份量比较足", ko: "넉넉한 편" },
      5: { zh: "份量很足", ko: "매우 넉넉함" },
    },
  },
  ordering_difficulty: {
    label: "点餐难度",
    values: {
      1: { zh: "点餐很容易", ko: "매우 쉬움" },
      2: { zh: "比较容易点餐", ko: "쉬움" },
      3: { zh: "点餐难度一般", ko: "보통" },
      4: { zh: "对外国游客稍有难度", ko: "어려움" },
      5: { zh: "没有韩语基础可能比较难点餐", ko: "외국인이 주문하기 매우 어려움" },
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

const tristateFields: Array<{
  key: keyof Pick<
    PlaceChinaInfoPayload,
    | "chinese_menu"
    | "foreign_card"
    | "alipay"
    | "wechat_pay"
    | "solo_friendly"
    | "luggage_friendly"
    | "toilet_available"
    | "reservation_required"
    | "xiaohongshu_popular"
    | "photo_recommended"
    | "tourism_recommended"
  >;
  label: string;
}> = [
  { key: "chinese_menu", label: "中文菜单" },
  { key: "foreign_card", label: "海外信用卡" },
  { key: "alipay", label: "支付宝" },
  { key: "wechat_pay", label: "微信支付" },
  { key: "solo_friendly", label: "一个人用餐" },
  { key: "luggage_friendly", label: "带行李箱" },
  { key: "toilet_available", label: "店内厕所" },
  { key: "reservation_required", label: "是否需要预约" },
  { key: "xiaohongshu_popular", label: "小红书热度" },
  { key: "photo_recommended", label: "拍照适合度" },
  { key: "tourism_recommended", label: "观光适合度" },
];

export function buildChinaPlaceSummary(info: ChinaPlaceInfoInput): ChinaPlaceSummary {
  const ratings = formatRatingDisplays(info);
  const paymentSummary = formatPaymentSummary(info);
  const convenienceSummary = formatConvenienceSummary(info);
  const waitingSummary = formatWaitingSummary(info);
  const automaticSummary = compactSentences([formatTasteSummary(info), waitingSummary, paymentSummary, convenienceSummary]);
  const manualSummary = info?.manual_summary_override?.trim();
  const automaticWarnings = formatWarnings(info);
  const manualWarning = info?.manual_warning_override?.trim();

  return {
    summary: manualSummary || automaticSummary,
    warnings: manualWarning ? [manualWarning, ...automaticWarnings] : automaticWarnings,
    unknownFacts: formatUnknownFacts(info),
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

  const spicy = normalizeScore(info.spicy_level);
  const greasy = normalizeScore(info.greasy_level);
  const smell = normalizeScore(info.smell_level);
  const portion = normalizeScore(info.portion_level);
  const ordering = normalizeScore(info.ordering_difficulty);
  const tasteScore = normalizeScore(info.chinese_taste_score);
  const parts: string[] = [];

  if (tasteScore) {
    parts.push(tasteScore >= 5 ? "整体很适合中国游客" : tasteScore >= 4 ? "整体比较推荐给中国游客" : "整体对中国游客来说可以考虑");
  }

  if (spicy && greasy) {
    if (spicy <= 2 && greasy <= 2) {
      parts.push("整体口味比较清淡");
    } else if (spicy >= 4) {
      parts.push(`整体口味${ratingHelp.spicy_level.values[spicy].zh}`);
    } else if (greasy >= 4) {
      parts.push(`整体口味${ratingHelp.greasy_level.values[greasy].zh}`);
    }
  }

  if (greasy) {
    parts.push(greasy <= 2 ? "不太油腻" : ratingHelp.greasy_level.values[greasy].zh);
  }

  if (spicy) {
    parts.push(ratingHelp.spicy_level.values[spicy].zh);
  }

  if (smell) {
    parts.push(smell === 1 ? "肉类的腥味也不明显" : ratingHelp.smell_level.values[smell].zh);
  }

  if (portion) {
    parts.push(ratingHelp.portion_level.values[portion].zh);
  }

  if (ordering) {
    parts.push(ratingHelp.ordering_difficulty.values[ordering].zh);
  }

  if (parts.length === 0) {
    return "这家店的口味、份量和点餐难度还在确认中。";
  }

  return `${dedupe(parts).join("，")}。`;
}

export function formatWaitingSummary(info: ChinaPlaceInfoInput) {
  if (!info || info.waiting_level === "unknown") {
    return "等位情况暂未确认。";
  }

  if (info.waiting_level === "none") {
    return "通常不太需要排队。";
  }

  if (info.waiting_level === "varies") {
    return "等位时间会随时段变化，建议高峰期提前确认。";
  }

  return `用餐高峰期通常需要等${waitingLabel(info.waiting_level)}。`;
}

export function formatPaymentSummary(info: ChinaPlaceInfoInput) {
  if (!info) {
    return "支付方式暂未确认。";
  }

  const supported = [
    info.foreign_card === "yes" ? "海外信用卡" : null,
    info.alipay === "yes" ? "支付宝" : null,
    info.wechat_pay === "yes" ? "微信支付" : null,
  ].filter((item): item is string => Boolean(item));
  const unsupported = [
    info.foreign_card === "no" ? "海外信用卡" : null,
    info.alipay === "no" ? "支付宝" : null,
    info.wechat_pay === "no" ? "微信支付" : null,
  ].filter((item): item is string => Boolean(item));
  const unknown = [
    isUnknownFact(info.foreign_card) ? "海外信用卡" : null,
    isUnknownFact(info.alipay) ? "支付宝" : null,
    isUnknownFact(info.wechat_pay) ? "微信支付" : null,
  ].filter((item): item is string => Boolean(item));
  const parts: string[] = [];

  if (supported.length) {
    parts.push(`支持${joinChineseList(supported)}`);
  }

  if (unsupported.length) {
    parts.push(`不支持${joinChineseList(unsupported)}`);
  }

  if (unknown.length) {
    parts.push(`${joinChineseList(unknown)}暂未确认`);
  }

  if (parts.length === 0) {
    return "支付方式暂未确认。";
  }

  return `${parts.join("，")}。`;
}

export function formatConvenienceSummary(info: ChinaPlaceInfoInput) {
  if (!info) {
    return "中文菜单、单人用餐和行李存放情况暂未确认。";
  }

  const parts = [
    info.solo_friendly === "yes" ? "一个人也可以用餐" : null,
    info.solo_friendly === "no" ? "不太适合一个人用餐" : null,
    info.chinese_menu === "yes" ? "有中文菜单" : null,
    info.chinese_menu === "no" ? "目前没有确认到中文菜单" : null,
    info.luggage_friendly === "yes" ? "带行李箱也比较方便" : null,
    info.luggage_friendly === "no" ? "带大行李箱可能不方便" : null,
    info.toilet_available === "yes" ? "店内厕所可用" : null,
    info.toilet_available === "no" ? "店内暂无可用厕所" : null,
    info.reservation_required === "yes" ? "建议提前预约" : null,
  ].filter((item): item is string => Boolean(item));

  if (parts.length === 0) {
    return "中文菜单、单人用餐和行李存放情况暂未确认。";
  }

  return `${joinWithBut(parts)}。`;
}

export function formatWarnings(info: ChinaPlaceInfoInput) {
  if (!info) {
    return [];
  }

  const warnings: string[] = [];

  if (info.chinese_menu === "no") warnings.push("目前没有中文菜单");
  if (info.foreign_card === "no") warnings.push("不支持海外信用卡");
  if (info.luggage_friendly === "no") warnings.push("带大行李箱可能不方便");
  if (info.reservation_required === "yes") warnings.push("建议提前预约");
  if (info.minimum_order_policy === "two_plus") warnings.push("通常需要2人份起点");
  if (info.minimum_order_policy === "three_plus") warnings.push("通常需要3人份起点");
  if (info.minimum_order_policy === "other") warnings.push(info.minimum_order_note?.trim() || "有最低点餐限制");
  if ((info.spicy_level ?? 0) >= 5) warnings.push("很辣，不吃辣的人要注意");
  if ((info.smell_level ?? 0) >= 4) warnings.push("气味比较明显，对气味敏感的人要注意");
  if (info.waiting_level === "long") warnings.push("高峰期可能需要等20~40分钟");
  if (info.waiting_level === "extreme") warnings.push("高峰期可能需要等40分钟以上");

  return warnings.length ? warnings : ["暂未发现特别需要注意的事项"];
}

export function formatUnknownFacts(info: ChinaPlaceInfoInput) {
  if (!info) {
    return ["中国游客适配信息暂未确认"];
  }

  const unknownFacts = tristateFields
    .filter((field) => isUnknownFact(info[field.key]))
    .map((field) => `${field.label}暂未确认`);

  if (!info.waiting_level || info.waiting_level === "unknown") {
    unknownFacts.push("等位情况暂未确认");
  }

  if (!info.minimum_order_policy || info.minimum_order_policy === "unknown") {
    unknownFacts.push("最低点餐限制暂未确认");
  }

  return unknownFacts;
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

export function minimumOrderLabel(value: ChinaMinimumOrderPolicy | null | undefined, note?: string | null) {
  if (value === "none") return "没有最低点餐限制";
  if (value === "two_plus") return "2人份起点";
  if (value === "three_plus") return "3人份起点";
  if (value === "other") return note?.trim() || "有最低点餐限制";
  return unknownText;
}

function normalizeScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) {
    return null;
  }

  return Math.round(value);
}

function isUnknownFact(value: PlaceFactTristate | null | undefined) {
  return value !== "yes" && value !== "no";
}

function compactSentences(sentences: string[]) {
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .join("")
    .replaceAll("。。", "。");
}

function joinChineseList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]}和${items[1]}`;
  }

  return `${items.slice(0, -1).join("、")}和${items[items.length - 1]}`;
}

function joinWithBut(parts: string[]) {
  const negativeIndex = parts.findIndex((part) => part.includes("没有") || part.includes("不太") || part.includes("不方便") || part.includes("不明确"));

  if (negativeIndex <= 0) {
    return parts.join("，");
  }

  return `${parts.slice(0, negativeIndex).join("，")}，但${parts.slice(negativeIndex).join("，")}`;
}

function dedupe(items: string[]) {
  return Array.from(new Set(items));
}
