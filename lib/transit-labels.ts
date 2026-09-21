import type { Locale } from "@/lib/i18n";

const stationNames: Record<string, Record<Exclude<Locale, "ko">, string>> = {
  광안: { zh: "广安站", en: "Gwangan Station", ja: "広安駅" },
  금련산: { zh: "金莲山站", en: "Geumnyeonsan Station", ja: "金蓮山駅" },
  수영: { zh: "水营站", en: "Suyeong Station", ja: "水営駅" },
  신사: { zh: "新沙站", en: "Sinsa Station", ja: "新沙駅" },
  일광: { zh: "日光站", en: "Ilgwang Station", ja: "日光駅" },
  전포: { zh: "田浦站", en: "Jeonpo Station", ja: "田浦駅" },
  해운대: { zh: "海云台站", en: "Haeundae Station", ja: "海雲台駅" },
};

export function formatLocalizedStation(value: string | null | undefined, locale: Locale) {
  const original = value?.trim() ?? "";
  if (!original || locale === "ko") return original;

  const key = original.replace(/역$/, "").trim();
  const translated = stationNames[key]?.[locale]
    ?? { zh: "地铁站", en: "Subway station", ja: "地下鉄駅" }[locale];
  return `${translated}（${original}）`;
}

export function formatLocalizedExit(value: string | null | undefined, locale: Locale) {
  const original = value?.trim() ?? "";
  if (!original) return "";
  const exitNumber = original.match(/(\d+)/)?.[1];
  if (!exitNumber) return locale === "ko" ? original : `${exitLabel[locale]}（${original}）`;
  if (locale === "zh") return `${exitNumber}号出口`;
  if (locale === "en") return `Exit ${exitNumber}`;
  if (locale === "ja") return `${exitNumber}番出口`;
  return `${exitNumber}번 출구`;
}

const exitLabel: Record<Locale, string> = {
  zh: "出口",
  en: "Exit",
  ja: "出口",
  ko: "출구",
};
