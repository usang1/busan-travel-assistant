import { guideTypes, type GuidePayload, type GuideText } from "@/types/guide";

const languages = ["ko", "zh", "en", "ja"] as const;
export const emptyGuideText = (): GuideText => ({ ko: "", zh: "", en: "", ja: "" });
export const guideUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function guideInputError(message: string, status = 400): Error {
  return Object.assign(new Error(message), { status, expose: true });
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw guideInputError("입력 형식을 확인해주세요.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 4000): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw guideInputError(`문자열은 ${max}자 이내로 입력해주세요.`);
  return value.trim();
}
function integer(value: unknown, max: number, nullable = false): number | null {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) throw guideInputError("시간과 순서는 범위 내의 정수로 입력해주세요.");
  return value;
}
function translated(value: unknown): GuideText {
  const input = value === undefined ? {} : object(value);
  return Object.fromEntries(languages.map((locale) => [locale, text(input[locale])])) as GuideText;
}
export function validateGuidePayload(value: unknown): GuidePayload {
  const input = object(value);
  const slug = text(input.slug, 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw guideInputError("URL은 영문 소문자, 숫자, 하이픈으로 입력해주세요.");
  if (input.status !== "DRAFT" && input.status !== "PUBLISHED") throw guideInputError("공개 상태가 올바르지 않습니다.");
  if (!guideTypes.includes(input.guide_type as GuidePayload["guide_type"])) throw guideInputError("가이드 유형을 선택해주세요.");
  if (!["ANY", "SUNNY", "RAINY", "INDOOR"].includes(String(input.weather_type))) throw guideInputError("날씨 조건을 선택해주세요.");
  const copy = Object.fromEntries(languages.flatMap((locale) => [
    [`title_${locale}`, text(input[`title_${locale}`], 200)],
    [`description_${locale}`, text(input[`description_${locale}`])],
  ])) as Pick<GuidePayload, "title_ko" | "title_zh" | "title_en" | "title_ja" | "description_ko" | "description_zh" | "description_en" | "description_ja">;
  if (!copy.title_ko) throw guideInputError("관리용 한국어 제목을 입력해주세요.");
  if (input.status === "PUBLISHED" && languages.some((locale) => !copy[`title_${locale}`] || !copy[`description_${locale}`])) {
    throw guideInputError("공개 전 네 언어의 제목과 설명을 모두 입력해주세요.");
  }
  const cover = text(input.cover_image, 2048);
  if (cover) {
    try { if (new URL(cover).protocol !== "https:") throw new Error(); }
    catch { throw guideInputError("대표 이미지는 HTTPS URL을 입력해주세요."); }
  }
  if (!Array.isArray(input.places) || input.places.length > 80) throw guideInputError("장소는 최대 80개까지 추가할 수 있습니다.");
  const seen = new Set<string>();
  const places = input.places.map((value, sequence) => {
    const stop = object(value);
    const placeId = text(stop.place_id, 36).toLowerCase();
    if (!guideUuid.test(placeId) || seen.has(placeId)) throw guideInputError("장소 ID가 올바르지 않거나 중복되었습니다.");
    seen.add(placeId);
    return {
      place_id: placeId, sequence,
      custom_title: translated(stop.custom_title), custom_description: translated(stop.custom_description),
      transportation_note: translated(stop.transportation_note), tip: translated(stop.tip),
      stay_minutes: integer(stop.stay_minutes, 10080, true),
    };
  });
  if (typeof input.is_featured !== "boolean") throw guideInputError("추천 여부가 올바르지 않습니다.");
  return {
    ...copy, slug, status: input.status, guide_type: input.guide_type as GuidePayload["guide_type"],
    cover_image: cover, area: text(input.area, 100), estimated_duration: integer(input.estimated_duration, 43200, true),
    recommended_for: translated(input.recommended_for), weather_type: input.weather_type as GuidePayload["weather_type"],
    sort_order: integer(input.sort_order, 100000) as number, is_featured: input.is_featured, places,
  };
}
