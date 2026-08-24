export type TranslatorCategory = "restaurant" | "transport" | "shopping" | "hotel" | "emergency";

export type TouristPhrase = {
  id: string;
  category: TranslatorCategory;
  titleZh: string;
  titleKo: string;
  zh: string;
  ko: string;
};

export const translatorCategories: Array<{ id: TranslatorCategory; zh: string; ko: string }> = [
  { id: "restaurant", zh: "餐厅", ko: "음식점" },
  { id: "transport", zh: "交通", ko: "교통" },
  { id: "shopping", zh: "购物", ko: "쇼핑" },
  { id: "hotel", zh: "酒店", ko: "숙소" },
  { id: "emergency", zh: "紧急", ko: "긴급" },
];

export const touristPhrases: TouristPhrase[] = [
  {
    id: "no-cilantro",
    category: "restaurant",
    titleZh: "不要香菜",
    titleKo: "고수 빼기",
    zh: "不要香菜。",
    ko: "고수 빼주세요.",
  },
  {
    id: "not-spicy",
    category: "restaurant",
    titleZh: "请不要太辣",
    titleKo: "맵지 않게",
    zh: "请不要太辣。",
    ko: "맵지 않게 해주세요.",
  },
  {
    id: "card-payment",
    category: "shopping",
    titleZh: "可以刷卡吗？",
    titleKo: "카드 결제",
    zh: "可以刷卡吗？",
    ko: "카드 결제되나요?",
  },
  {
    id: "luggage-storage",
    category: "hotel",
    titleZh: "可以寄存行李吗？",
    titleKo: "캐리어 보관",
    zh: "可以寄存行李吗？",
    ko: "캐리어를 맡길 수 있나요?",
  },
  {
    id: "taxi-here",
    category: "transport",
    titleZh: "请带我去这里。",
    titleKo: "여기로 가기",
    zh: "请带我去这里。",
    ko: "여기로 가주세요.",
  },
  {
    id: "receipt",
    category: "shopping",
    titleZh: "请给我收据",
    titleKo: "영수증 요청",
    zh: "请给我收据。",
    ko: "영수증 주세요.",
  },
  {
    id: "call-police",
    category: "emergency",
    titleZh: "请帮我报警",
    titleKo: "경찰 신고",
    zh: "请帮我报警。",
    ko: "경찰에 신고해 주세요.",
  },
];
