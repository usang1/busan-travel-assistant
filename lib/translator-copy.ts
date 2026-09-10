import type { Locale } from "@/lib/i18n";
import type { TouristPhrase } from "@/data/translator-phrases";

export const translatorUi = {
  ko: { input: "번역할 문장", placeholder: "예: 짐을 맡길 수 있나요?", translate: "한국어로 번역", busy: "번역 중...", error: "번역하지 못했습니다. 잠시 후 다시 시도해주세요.", empty: "번역할 문장을 입력해주세요.", korean: "직원에게 보여줄 한국어", speak: "한국어 음성 읽기", close: "닫기", show: "직원에게 보여주세요", categories: { restaurant: "음식점", transport: "교통", shopping: "쇼핑", hotel: "숙소", emergency: "긴급" } },
  zh: { input: "要翻译的句子", placeholder: "例如：请问可以寄存行李吗？", translate: "翻译成韩语", busy: "翻译中...", error: "翻译失败，请稍后重试。", empty: "请输入要翻译的句子。", korean: "给店员看的韩语", speak: "朗读韩语", close: "关闭", show: "请把这个画面给店员看", categories: { restaurant: "餐厅", transport: "交通", shopping: "购物", hotel: "酒店", emergency: "紧急" } },
  en: { input: "Text to translate", placeholder: "For example: Can I leave my luggage here?", translate: "Translate to Korean", busy: "Translating...", error: "Translation failed. Please try again later.", empty: "Enter a sentence to translate.", korean: "Korean phrase for staff", speak: "Read Korean aloud", close: "Close", show: "Show this screen to staff", categories: { restaurant: "Restaurants", transport: "Transport", shopping: "Shopping", hotel: "Hotels", emergency: "Emergency" } },
  ja: { input: "翻訳する文章", placeholder: "例：荷物を預けられますか？", translate: "韓国語に翻訳", busy: "翻訳中...", error: "翻訳できませんでした。後でもう一度お試しください。", empty: "翻訳する文章を入力してください。", korean: "スタッフに見せる韓国語", speak: "韓国語を読み上げる", close: "閉じる", show: "この画面をスタッフに見せてください", categories: { restaurant: "飲食店", transport: "交通", shopping: "買い物", hotel: "ホテル", emergency: "緊急" } },
} satisfies Record<Locale, Record<string, unknown>>;

const phraseTranslations: Record<string, { en: string; ja: string }> = {
  "no-cilantro": { en: "No cilantro, please.", ja: "パクチーを抜いてください。" },
  "not-spicy": { en: "Please make it not spicy.", ja: "辛くしないでください。" },
  "card-payment": { en: "Can I pay by card?", ja: "カードで払えますか？" },
  "luggage-storage": { en: "Can I leave my luggage here?", ja: "荷物を預けられますか？" },
  "taxi-here": { en: "Please take me here.", ja: "ここまでお願いします。" },
  receipt: { en: "May I have a receipt?", ja: "レシートをください。" },
  "call-police": { en: "Please call the police.", ja: "警察を呼んでください。" },
};

export function translatedPhrase(phrase: TouristPhrase, locale: Locale) {
  return locale === "ko" ? phrase.ko : locale === "zh" ? phrase.zh : phraseTranslations[phrase.id]?.[locale] ?? "";
}
