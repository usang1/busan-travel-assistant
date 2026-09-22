import type { Locale } from "@/lib/i18n";
import type { PlaceMenuItem } from "@/types/database";

export type MenuGuidancePreferences = {
  people: number;
  spicy: "avoid" | "okay";
  oily: "avoid" | "okay";
  seafood: "avoid" | "okay";
  cilantro: "avoid" | "okay";
  budget: number | null;
  mealType: "meal" | "snack";
  representativeFirst: boolean;
};

export type MenuGuidanceResult = {
  lines: Array<{ item: PlaceMenuItem; quantity: number; reasons: string[] }>;
  total: number | null;
  warnings: string[];
  koreanOrderText: string;
};

export function recommendMenuCombination(menuItems: PlaceMenuItem[], preferences: MenuGuidancePreferences, locale: Locale, at = new Date()): MenuGuidanceResult {
  const warnings: string[] = [];
  const candidates = menuItems
    .filter((item) => isMenuAvailable(item, at))
    .filter((item) => preferences.seafood === "okay" || item.contains_seafood !== "yes")
    .filter((item) => preferences.cilantro === "okay" || item.contains_cilantro !== "yes")
    .filter((item) => preferences.spicy === "okay" || item.spicy_level === null || item.spicy_level === undefined || item.spicy_level <= 2)
    .filter((item) => preferences.oily === "okay" || item.oily_level === null || item.oily_level === undefined || item.oily_level <= 2)
    .filter((item) => !item.meal_type || item.meal_type === "both" || item.meal_type === preferences.mealType)
    .map((item) => ({ item, score: menuScore(item, preferences), reasons: menuReasons(item, preferences, locale), quantity: item.recommended_party_size ? Math.max(1, Math.ceil(preferences.people / item.recommended_party_size)) : 1 }))
    .sort((a, b) => b.score - a.score || a.item.sort_order - b.item.sort_order);

  const selected = selectMenuLines(candidates, preferences.people >= 2 ? 2 : 1, preferences.budget);

  if (preferences.seafood === "avoid" && selected.some((line) => (line.item.contains_seafood ?? "unknown") === "unknown")) warnings.push(copy[locale].seafoodUnknown);
  if (preferences.cilantro === "avoid" && selected.some((line) => (line.item.contains_cilantro ?? "unknown") === "unknown")) warnings.push(copy[locale].cilantroUnknown);
  if (preferences.spicy === "avoid" && selected.some((line) => line.item.spicy_level === null || line.item.spicy_level === undefined)) warnings.push(copy[locale].spicyUnknown);
  if (preferences.oily === "avoid" && selected.some((line) => line.item.oily_level === null || line.item.oily_level === undefined)) warnings.push(copy[locale].oilyUnknown);
  if (selected.some((line) => !line.item.recommended_party_size)) warnings.push(copy[locale].portionUnknown);
  if (selected.some((line) => line.item.sold_out_risk !== null && line.item.sold_out_risk !== undefined && line.item.sold_out_risk >= 4)) warnings.push(copy[locale].selloutRisk);
  const pricesKnown = selected.length > 0 && selected.every((line) => typeof line.item.price === "number");
  const total = pricesKnown ? selected.reduce((sum, line) => sum + (line.item.price ?? 0) * line.quantity, 0) : null;
  if (preferences.budget !== null && total !== null && total > preferences.budget) warnings.push(copy[locale].overBudget);
  if (preferences.budget !== null && selected.length > 0 && total === null) warnings.push(copy[locale].budgetUnknown);
  const koreanParts = selected.map((line) => `${koreanMenuName(line.item)} ${line.quantity === 1 ? "하나" : `${line.quantity}개`}`);

  return {
    lines: selected.map(({ item, quantity, reasons }) => ({ item, quantity, reasons })),
    total,
    warnings,
    koreanOrderText: koreanParts.length ? `${koreanParts.join(", ")} 주세요.` : "주문 가능한 메뉴를 추천해 주세요.",
  };
}

function selectMenuLines<T extends { item: PlaceMenuItem; quantity: number; score: number }>(candidates: T[], count: number, budget: number | null) {
  if (budget === null) return candidates.slice(0, count);
  const combinations: T[][] = candidates.map((candidate) => [candidate]);
  if (count > 1) {
    for (let left = 0; left < candidates.length; left += 1) {
      for (let right = left + 1; right < candidates.length; right += 1) combinations.push([candidates[left], candidates[right]]);
    }
  }
  const affordable = combinations.filter((lines) => lines.every((line) => typeof line.item.price === "number") && lines.reduce((sum, line) => sum + (line.item.price ?? 0) * line.quantity, 0) <= budget);
  return affordable.sort((left, right) => right.length - left.length || right.reduce((sum, line) => sum + line.score, 0) - left.reduce((sum, line) => sum + line.score, 0))[0] ?? candidates.slice(0, count);
}

function isMenuAvailable(item: PlaceMenuItem, at: Date) {
  const ranges = item.availability_time ?? [];
  if (!ranges.length) return true;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdays[parts.weekday] ?? 0;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return ranges.some((range) => {
    const start = clockValue(range.start);
    const end = clockValue(range.end);
    if (start <= end) return range.weekdays.includes(weekday) && minute >= start && minute < end;
    return (range.weekdays.includes(weekday) && minute >= start) || (range.weekdays.includes((weekday + 6) % 7) && minute < end);
  });
}

function clockValue(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function koreanMenuName(item: PlaceMenuItem) {
  return item.korean_original_name?.trim() || item.localized_name?.ko?.trim() || item.name_ko.trim();
}

function menuScore(item: PlaceMenuItem, preferences: MenuGuidancePreferences) {
  let score = 0;
  if (preferences.representativeFirst && item.recommendation_status === "yes" && item.recommendation_basis?.trim()) score += 30;
  if (item.recommended_party_size === preferences.people) score += 12;
  if (preferences.spicy === "avoid" && typeof item.spicy_level === "number" && item.spicy_level <= 2) score += 10;
  if (preferences.oily === "avoid" && typeof item.oily_level === "number" && item.oily_level <= 2) score += 8;
  if (typeof item.aroma_level === "number" && item.aroma_level <= 2) score += 4;
  if (item.meal_type === preferences.mealType || item.meal_type === "both") score += 8;
  if (preferences.budget !== null && typeof item.price === "number" && item.price <= preferences.budget) score += 6;
  return score;
}

function menuReasons(item: PlaceMenuItem, preferences: MenuGuidancePreferences, locale: Locale) {
  const reasons: string[] = [];
  if (item.recommendation_status === "yes" && item.recommendation_basis?.trim()) reasons.push(copy[locale].representative);
  if (preferences.spicy === "avoid" && typeof item.spicy_level === "number" && item.spicy_level <= 2) reasons.push(copy[locale].mild);
  if (preferences.oily === "avoid" && typeof item.oily_level === "number" && item.oily_level <= 2) reasons.push(copy[locale].notOily);
  if (typeof item.aroma_level === "number" && item.aroma_level <= 2) reasons.push(copy[locale].mildAroma);
  if (typeof item.portion_size === "number" && item.portion_size >= 4) reasons.push(copy[locale].largePortion);
  return reasons;
}

const copy: Record<Locale, Record<string, string>> = {
  ko: { representative: "근거가 확인된 대표 메뉴", mild: "맵지 않은 편", notOily: "기름지지 않은 편", mildAroma: "향이 순한 편", largePortion: "양이 많은 편", seafoodUnknown: "선택 메뉴의 해산물 포함 여부가 일부 미확인입니다.", cilantroUnknown: "선택 메뉴의 고수 포함 여부가 일부 미확인입니다.", spicyUnknown: "선택 메뉴의 매운맛이 일부 미확인입니다.", oilyUnknown: "선택 메뉴의 기름진 정도가 일부 미확인입니다.", portionUnknown: "메뉴별 권장 인원이 없어 수량은 직원에게 확인해야 합니다.", selloutRisk: "품절 위험이 높은 메뉴가 포함됐습니다.", overBudget: "예상 총액이 입력한 예산을 넘습니다.", budgetUnknown: "가격이 미확인된 메뉴가 있어 예산과 비교할 수 없습니다." },
  zh: { representative: "有依据的招牌菜单", mild: "辣度较低", notOily: "不太油腻", mildAroma: "香味温和", largePortion: "份量较多", seafoodUnknown: "部分所选菜单的海鲜信息尚未确认。", cilantroUnknown: "部分所选菜单的香菜信息尚未确认。", spicyUnknown: "部分所选菜单的辣度尚未确认。", oilyUnknown: "部分所选菜单的油腻程度尚未确认。", portionUnknown: "菜单建议人数未确认，请向店员确认数量。", selloutRisk: "组合中包含售罄风险较高的菜单。", overBudget: "预计总额超过输入的预算。", budgetUnknown: "部分菜单价格尚未确认，无法与预算比较。" },
  en: { representative: "Verified signature item", mild: "Lower spice", notOily: "Less oily", mildAroma: "Mild aroma", largePortion: "Large portion", seafoodUnknown: "Seafood content is unverified for some selected items.", cilantroUnknown: "Cilantro content is unverified for some selected items.", spicyUnknown: "Spice level is unverified for some selected items.", oilyUnknown: "Oiliness is unverified for some selected items.", portionUnknown: "Recommended party size is unknown; confirm quantities with staff.", selloutRisk: "This combination includes an item with high sellout risk.", overBudget: "Estimated total exceeds the entered budget.", budgetUnknown: "Some menu prices are unverified, so the total cannot be compared with your budget." },
  ja: { representative: "根拠確認済みの代表メニュー", mild: "辛さ控えめ", notOily: "脂控えめ", mildAroma: "香り穏やか", largePortion: "量が多め", seafoodUnknown: "一部メニューの海鮮有無は未確認です。", cilantroUnknown: "一部メニューのパクチー有無は未確認です。", spicyUnknown: "一部メニューの辛さは未確認です。", oilyUnknown: "一部メニューの脂っこさは未確認です。", portionUnknown: "推奨人数が未確認のため、数量はスタッフに確認してください。", selloutRisk: "売切れリスクが高いメニューを含みます。", overBudget: "予想合計が入力した予算を超えています。", budgetUnknown: "価格未確認のメニューがあるため、予算と比較できません。" },
};
