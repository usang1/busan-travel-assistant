import type { Locale } from "@/lib/i18n";

export const guidePlanningCopy = {
  ko: { compare: "장소 비교", place: "장소", category: "유형", price: "가격", address: "위치", hours: "영업시간", waiting: "웨이팅", route: "이동 순서와 예상 시간", avoid: "추천하지 않는 대상", tips: "실패 방지 팁", faq: "자주 묻는 질문", sources: "출처와 마지막 확인일", updated: "가이드 수정일", checked: "마지막 확인일", pending: "확인된 정보가 아직 없습니다.", durationQuestion: "얼마나 걸리나요?", weatherQuestion: "어떤 날씨에 적합한가요?", official: "공식 링크" },
  zh: { compare: "地点对比", place: "地点", category: "类型", price: "价格", address: "位置", hours: "营业时间", waiting: "等位", route: "路线顺序与预计用时", avoid: "不适合的人群", tips: "出发前注意事项", faq: "常见问题", sources: "来源与最后确认日期", updated: "指南更新日期", checked: "最后确认日期", pending: "暂无已确认的信息。", durationQuestion: "需要多长时间？", weatherQuestion: "适合什么天气？", official: "官方网站" },
  en: { compare: "Compare places", place: "Place", category: "Type", price: "Price", address: "Location", hours: "Hours", waiting: "Wait", route: "Route and estimated times", avoid: "Not recommended for", tips: "Before you go", faq: "Frequently asked questions", sources: "Sources and last checked", updated: "Guide updated", checked: "Last checked", pending: "No confirmed information yet.", durationQuestion: "How long does it take?", weatherQuestion: "What weather is it suitable for?", official: "Official website" },
  ja: { compare: "スポット比較", place: "スポット", category: "種類", price: "料金", address: "場所", hours: "営業時間", waiting: "待ち時間", route: "移動順序と所要時間", avoid: "おすすめしない方", tips: "出発前の注意点", faq: "よくある質問", sources: "出典と最終確認日", updated: "ガイド更新日", checked: "最終確認日", pending: "確認済みの情報はまだありません。", durationQuestion: "どのくらい時間がかかりますか？", weatherQuestion: "どんな天気に適していますか？", official: "公式サイト" },
} satisfies Record<Locale, Record<string, string>>;

export function guideQuestion(title: string, locale: Locale) {
  if (/[?？]$/.test(title.trim())) return title.trim();
  return {
    ko: `${title}: 어떻게 여행하면 좋을까요?`,
    zh: `${title}，该怎么安排？`,
    en: `${title}: how should I plan my visit?`,
    ja: `${title}：どのように回ればよいですか？`,
  }[locale];
}
