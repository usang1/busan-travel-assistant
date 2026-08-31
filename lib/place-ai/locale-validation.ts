import type { PlaceContentLocale } from "@/types/place-ai";

export type LocaleTextValidation = {
  valid: boolean;
  warning: string;
};

export function validateLocaleText(value: string, locale: PlaceContentLocale): LocaleTextValidation {
  const text = value.trim();
  if (!text) return { valid: false, warning: "생성된 문장이 없습니다." };

  const counts = scriptCounts(text);
  const letterCount = counts.hangul + counts.han + counts.kana + counts.latin;
  const foreignRatio = (counts.hangul + counts.han + counts.kana) / Math.max(1, letterCount);

  if (locale === "ko" && counts.hangul < 2) {
    return { valid: false, warning: "한국어 문장으로 확인되지 않습니다." };
  }

  if (locale === "zh" && (counts.han < 2 || counts.kana > 0 || isLikelyKoreanCopy(text, locale))) {
    return { valid: false, warning: "간체 중국어 문장으로 확인되지 않거나 한국어 원문이 복사되었습니다." };
  }

  if (locale === "en" && (counts.latin < 4 || foreignRatio > 0.45)) {
    return { valid: false, warning: "영어 문장으로 확인되지 않습니다." };
  }

  if (locale === "ja" && ((counts.kana < 1 && counts.han < 2) || isLikelyKoreanCopy(text, locale))) {
    return { valid: false, warning: "일본어 문장으로 확인되지 않거나 한국어 원문이 복사되었습니다." };
  }

  return { valid: true, warning: "" };
}

export function validateLocalizedAddress(value: string, sourceAddressKo: string, locale: PlaceContentLocale): LocaleTextValidation {
  const text = value.trim();
  if (!text) return { valid: false, warning: "번역된 주소가 없습니다." };
  if (locale === "ko") return { valid: true, warning: "" };

  if (normalizeComparable(text) === normalizeComparable(sourceAddressKo) || isLikelyKoreanCopy(text, locale)) {
    return { valid: false, warning: "한국어 주소가 번역 없이 복사되었습니다." };
  }

  const missingNumbers = extractNumberTokens(sourceAddressKo).filter((number) => !extractNumberTokens(text).includes(number));
  if (missingNumbers.length > 0) {
    return { valid: false, warning: `주소 숫자가 누락되었습니다: ${missingNumbers.join(", ")}` };
  }

  return validateLocaleText(text, locale);
}

export function sanitizeLocalizedAddress(value: unknown, sourceAddressKo: string, locale: PlaceContentLocale) {
  const text = typeof value === "string" ? value.trim().slice(0, 300) : "";
  return validateLocalizedAddress(text, sourceAddressKo, locale).valid ? text : "";
}

export function isLikelyKoreanCopy(value: string, targetLocale: Exclude<PlaceContentLocale, "ko"> | PlaceContentLocale) {
  if (targetLocale === "ko") return false;
  const counts = scriptCounts(value);
  const targetCount = targetLocale === "zh" ? counts.han : targetLocale === "ja" ? counts.han + counts.kana : counts.latin;
  return counts.hangul >= 4 && (targetCount === 0 || counts.hangul > targetCount * 0.6);
}

function scriptCounts(value: string) {
  return {
    hangul: countMatches(value, /[ㄱ-ㅎㅏ-ㅣ가-힣]/g),
    han: countMatches(value, /[\u3400-\u9fff]/g),
    kana: countMatches(value, /[\u3040-\u30ff]/g),
    latin: countMatches(value, /[A-Za-z]/g),
  };
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function extractNumberTokens(value: string): string[] {
  return value.match(/\d+(?:-\d+)?/g) ?? [];
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣一-龥]/g, "");
}
