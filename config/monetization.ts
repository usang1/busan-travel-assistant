export type PassProductId = "pass_3day" | "pass_7day";

export type PassProduct = {
  id: PassProductId;
  titleZh: string;
  titleKo: string;
  durationDays: number;
  priceCny: number;
  badge: string;
};

export const passProducts: PassProduct[] = [
  {
    id: "pass_3day",
    titleZh: "3日通行证",
    titleKo: "3일 이용권",
    durationDays: 3,
    priceCny: 19.9,
    badge: "短途旅行",
  },
  {
    id: "pass_7day",
    titleZh: "7日通行证",
    titleKo: "7일 이용권",
    durationDays: 7,
    priceCny: 29.9,
    badge: "慢旅行",
  },
];

export const freeFeatures = ["场所搜索", "点餐指南", "给韩国人看", "部分拍照点", "1日行程", "收藏"];

export const proFeatures = ["全部拍照点", "2日以上行程", "重新生成", "保存行程", "雨天替代路线", "PRO 本地场所", "完整拍照提示"];
