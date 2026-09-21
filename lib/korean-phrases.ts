export function buildKoreanTaxiSentence(address: string | null | undefined, placeName: string | null | undefined) {
  const koreanAddress = address?.trim() ?? "";
  const koreanName = placeName?.trim() ?? "";
  const addressIncludesName = Boolean(koreanName && normalizeSpacing(koreanAddress).includes(normalizeSpacing(koreanName)));
  const destination = [koreanAddress, addressIncludesName ? "" : koreanName].filter(Boolean).join(" ");
  if (!destination) return "";
  return `${destination}${directionParticle(koreanName || koreanAddress)} 가주세요.`;
}

function normalizeSpacing(value: string) {
  return value.replace(/\s+/g, "");
}

function directionParticle(value: string) {
  const last = value.trim().at(-1);
  if (!last) return "로";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "로";
  const finalConsonant = (code - 0xac00) % 28;
  return finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로";
}
