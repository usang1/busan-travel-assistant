import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/config/site";
import type { PlaceWithRelations } from "@/types/database";

export const locales = ["zh", "en", "ja", "ko"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh";

export const localeMeta: Record<
  Locale,
  {
    label: string;
    nativeLabel: string;
    languageTag: string;
    openGraphLocale: string;
  }
> = {
  zh: {
    label: "Chinese",
    nativeLabel: "简体中文",
    languageTag: "zh-CN",
    openGraphLocale: "zh_CN",
  },
  en: {
    label: "English",
    nativeLabel: "English",
    languageTag: "en",
    openGraphLocale: "en_US",
  },
  ja: {
    label: "Japanese",
    nativeLabel: "日本語",
    languageTag: "ja",
    openGraphLocale: "ja_JP",
  },
  ko: {
    label: "Korean",
    nativeLabel: "한국어",
    languageTag: "ko",
    openGraphLocale: "ko_KR",
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocaleFromPath(pathname: string): Locale | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isLocale(firstSegment) ? firstSegment : null;
}

export function withoutLocale(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (isLocale(segments[0])) {
    const nextPath = `/${segments.slice(1).join("/")}`;
    return nextPath === "/" ? "/" : nextPath.replace(/\/$/, "");
  }

  return pathname || "/";
}

export function withLocale(path: string, locale: Locale) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const basePath = withoutLocale(normalizedPath);

  if (basePath === "/") {
    return `/${locale}`;
  }

  return `/${locale}${basePath}`;
}

export function localeAlternates(path: string): NonNullable<Metadata["alternates"]>["languages"] {
  const basePath = withoutLocale(path);

  return locales.reduce<Record<string, string>>((acc, locale) => {
    acc[localeMeta[locale].languageTag] = absoluteUrl(withLocale(basePath, locale));
    return acc;
  }, {});
}

export function localizedCanonical(path: string, locale: Locale) {
  return absoluteUrl(withLocale(path, locale));
}

export const categoryLabels = {
  restaurant: { zh: "餐厅", en: "Restaurants", ja: "飲食店", ko: "음식점" },
  cafe: { zh: "咖啡", en: "Cafes", ja: "カフェ", ko: "카페" },
  bar: { zh: "酒吧", en: "Bars", ja: "バー", ko: "술집" },
  attraction: { zh: "景点", en: "Attractions", ja: "観光", ko: "관광" },
  shopping: { zh: "购物", en: "Shopping", ja: "ショッピング", ko: "쇼핑" },
  photo_spot: { zh: "拍照", en: "Photo spots", ja: "写真スポット", ko: "사진" },
  luggage: { zh: "行李寄存", en: "Luggage", ja: "荷物預かり", ko: "짐보관" },
} as const;

export const ui = {
  zh: {
    siteName: "釜山旅行助手",
    siteDescription: siteConfig.description,
    region: "广安里",
    nav: {
      home: "首页",
      nearby: "附近",
      itinerary: "行程",
      saved: "收藏",
    },
    footerLinks: {
      serviceInfo: "服务说明",
      privacy: "隐私政策",
      terms: "使用条款",
      contact: "联系方式",
    },
    footerNote: "信息可能会发生变化，请出发前再次确认。",
    common: {
      viewAll: "查看全部",
      live: "Live",
      demo: "Demo",
      backToPlaces: "返回附近推荐",
      unavailable: "暂未开放",
      available: "现在可查看",
      noInfo: "暂无信息",
      notRegistered: "未登记",
      free: "免费",
      priceUnknown: "价格未登记",
      walk: "步行",
      minutes: "分钟",
      perPerson: "人均",
      openMap: "打开地图",
    },
    home: {
      title: "釜山广安里旅行助手｜美食、拍照、行李寄存",
      description: "为中国自由行游客整理釜山广安里美食地图、拍照机位、韩语沟通、行李寄存和旅行路线。",
      area: "当前区域 · 广安里",
      heading: "釜山怎么玩？",
      subheading: "韩国本地人帮你整理好了。",
      supporting: "부산에서 어떻게 놀지? 한국 현지인이 정리해뒀어요.",
      recommended: "韩国本地人推荐",
      searchPlaceholder: "搜索美食、景点、咖啡店",
    },
    places: {
      title: "釜山广安里美食地图｜韩国本地人推荐",
      description: "搜索广安里餐厅、咖啡店、拍照点、购物和行李寄存，按类别与旅行需求快速筛选。",
      heading: "附近推荐",
      searchPlaceholder: "搜索中文名、韩文名、说明、类别",
      all: "全部",
      filter: "筛选",
      emptyTitle: "没有找到地点",
      emptyDescription: "减少筛选条件或搜索词后再试。",
      countLabel: "当前显示",
    },
    placeDetail: {
      titleFallback: "地点详情",
      recommendation: "推荐理由",
      menu: "推荐菜单",
      recommended: "推荐",
      noMenu: "등록된 메뉴가 없습니다.",
      howToSay: "怎么说？",
      waiting: "等候",
      directions: "怎么去？",
      travelTip: "旅行小贴士",
      payment: "付款",
      coordinates: "坐标",
      location: "位置",
      distanceFromYou: "距离你",
      walkingApprox: "步行约",
      calculateDistance: "거리 계산",
      confirmationNote: "信息可能会发生变化，请出发前再次确认。가격, 영업시간, 대기 정보는 변경될 수 있으니 방문 전 다시 확인하세요.",
    },
  },
  en: {
    siteName: "Busan Travel Assistant",
    siteDescription: "A Busan Gwangalli travel tool for food, photo spots, luggage storage, Korean phrases, and routes.",
    region: "Gwangalli",
    nav: {
      home: "Home",
      nearby: "Nearby",
      itinerary: "Routes",
      saved: "Saved",
    },
    footerLinks: {
      serviceInfo: "Service Info",
      privacy: "Privacy",
      terms: "Terms",
      contact: "Contact",
    },
    footerNote: "Details can change. Please confirm before you go.",
    common: {
      viewAll: "View all",
      live: "Live",
      demo: "Demo",
      backToPlaces: "Back to places",
      unavailable: "Unavailable",
      available: "Available",
      noInfo: "No information yet",
      notRegistered: "Not registered",
      free: "Free",
      priceUnknown: "Price not listed",
      walk: "Walk",
      minutes: "min",
      perPerson: "Avg.",
      openMap: "Open map",
    },
    home: {
      title: "Busan Gwangalli Travel Assistant | Food, Photos, Luggage",
      description: "Find Gwangalli restaurants, cafes, photo spots, luggage storage, Korean phrases, and travel routes.",
      area: "Current area · Gwangalli",
      heading: "What should I do in Busan?",
      subheading: "Local picks, organized for your trip.",
      supporting: "Built around Gwangalli food, photos, luggage, and short routes.",
      recommended: "Local recommendations",
      searchPlaceholder: "Search food, attractions, cafes",
    },
    places: {
      title: "Busan Gwangalli Places | Local Recommendations",
      description: "Search Gwangalli restaurants, cafes, photo spots, shopping, and luggage storage by category and travel need.",
      heading: "Nearby recommendations",
      searchPlaceholder: "Search names, descriptions, categories",
      all: "All",
      filter: "Filter",
      emptyTitle: "No places found",
      emptyDescription: "Try fewer filters or a shorter search term.",
      countLabel: "Showing",
    },
    placeDetail: {
      titleFallback: "Place details",
      recommendation: "Why go",
      menu: "Recommended menu",
      recommended: "Recommended",
      noMenu: "No menu items yet.",
      howToSay: "What to show staff",
      waiting: "Wait",
      directions: "How to get there",
      travelTip: "Travel tip",
      payment: "Payment",
      coordinates: "Coordinates",
      location: "Location",
      distanceFromYou: "From you",
      walkingApprox: "Walk about",
      calculateDistance: "Calculate",
      confirmationNote: "Prices, hours, and wait times can change. Please confirm before you go.",
    },
  },
  ja: {
    siteName: "釜山旅行アシスタント",
    siteDescription: "釜山・広安里のグルメ、写真スポット、荷物預かり、韓国語フレーズ、旅程をまとめた旅行ツール。",
    region: "広安里",
    nav: {
      home: "ホーム",
      nearby: "近く",
      itinerary: "旅程",
      saved: "保存",
    },
    footerLinks: {
      serviceInfo: "サービス案内",
      privacy: "プライバシー",
      terms: "利用規約",
      contact: "連絡先",
    },
    footerNote: "情報は変更される場合があります。出発前に再確認してください。",
    common: {
      viewAll: "すべて見る",
      live: "Live",
      demo: "Demo",
      backToPlaces: "スポット一覧へ",
      unavailable: "未公開",
      available: "閲覧可能",
      noInfo: "情報がありません",
      notRegistered: "未登録",
      free: "無料",
      priceUnknown: "価格未登録",
      walk: "徒歩",
      minutes: "分",
      perPerson: "目安",
      openMap: "地図を開く",
    },
    home: {
      title: "釜山・広安里旅行アシスタント｜グルメ・写真・荷物預かり",
      description: "広安里の飲食店、カフェ、写真スポット、荷物預かり、韓国語フレーズ、旅程を探せます。",
      area: "現在のエリア · 広安里",
      heading: "釜山で何をする？",
      subheading: "現地目線のおすすめを整理しました。",
      supporting: "広安里のグルメ、写真、荷物預かり、短い旅程に対応します。",
      recommended: "現地おすすめ",
      searchPlaceholder: "グルメ、観光、カフェを検索",
    },
    places: {
      title: "釜山・広安里スポット｜現地おすすめ",
      description: "広安里の飲食店、カフェ、写真スポット、買い物、荷物預かりをカテゴリ別に検索できます。",
      heading: "近くのおすすめ",
      searchPlaceholder: "名称、説明、カテゴリを検索",
      all: "すべて",
      filter: "絞り込み",
      emptyTitle: "スポットが見つかりません",
      emptyDescription: "条件や検索語を減らして再確認してください。",
      countLabel: "表示中",
    },
    placeDetail: {
      titleFallback: "スポット詳細",
      recommendation: "おすすめ理由",
      menu: "おすすめメニュー",
      recommended: "おすすめ",
      noMenu: "メニューはまだ登録されていません。",
      howToSay: "スタッフに見せる文",
      waiting: "待ち時間",
      directions: "行き方",
      travelTip: "旅のヒント",
      payment: "支払い",
      coordinates: "座標",
      location: "位置",
      distanceFromYou: "現在地から",
      walkingApprox: "徒歩約",
      calculateDistance: "計算",
      confirmationNote: "価格、営業時間、待ち時間は変更される場合があります。訪問前に再確認してください。",
    },
  },
  ko: {
    siteName: "부산 여행 어시스턴트",
    siteDescription: "부산 광안리 맛집, 사진스팟, 짐보관, 한국어 안내 문장, 여행 코스를 정리한 여행 도구입니다.",
    region: "광안리",
    nav: {
      home: "홈",
      nearby: "주변",
      itinerary: "일정",
      saved: "저장",
    },
    footerLinks: {
      serviceInfo: "서비스 안내",
      privacy: "개인정보처리방침",
      terms: "이용약관",
      contact: "문의",
    },
    footerNote: "정보가 변경될 수 있으니 방문 전 다시 확인하세요.",
    common: {
      viewAll: "전체 보기",
      live: "Live",
      demo: "Demo",
      backToPlaces: "장소 목록으로",
      unavailable: "비공개",
      available: "조회 가능",
      noInfo: "아직 정보가 없습니다",
      notRegistered: "미등록",
      free: "무료",
      priceUnknown: "가격 미등록",
      walk: "도보",
      minutes: "분",
      perPerson: "평균",
      openMap: "지도 열기",
    },
    home: {
      title: "부산 광안리 여행 어시스턴트 | 맛집, 사진, 짐보관",
      description: "광안리 음식점, 카페, 사진스팟, 짐보관, 한국어 안내 문장, 여행 코스를 찾을 수 있습니다.",
      area: "현재 지역 · 광안리",
      heading: "부산에서 뭐 할까?",
      subheading: "현지 기준 추천을 정리했습니다.",
      supporting: "광안리 맛집, 사진, 짐보관, 짧은 코스에 맞춘 여행 도구입니다.",
      recommended: "현지 추천",
      searchPlaceholder: "맛집, 관광지, 카페 검색",
    },
    places: {
      title: "부산 광안리 장소 | 현지 추천",
      description: "광안리 음식점, 카페, 사진스팟, 쇼핑, 짐보관을 카테고리와 여행 조건으로 찾습니다.",
      heading: "주변 추천",
      searchPlaceholder: "장소명, 설명, 카테고리 검색",
      all: "전체",
      filter: "필터",
      emptyTitle: "장소를 찾지 못했습니다",
      emptyDescription: "필터나 검색어를 줄여 다시 확인해 주세요.",
      countLabel: "현재 표시",
    },
    placeDetail: {
      titleFallback: "장소 상세",
      recommendation: "추천 이유",
      menu: "추천 메뉴",
      recommended: "추천",
      noMenu: "등록된 메뉴가 없습니다.",
      howToSay: "어떻게 말할까?",
      waiting: "웨이팅",
      directions: "가는 방법",
      travelTip: "여행 팁",
      payment: "결제",
      coordinates: "좌표",
      location: "위치",
      distanceFromYou: "내 위치에서",
      walkingApprox: "도보 약",
      calculateDistance: "거리 계산",
      confirmationNote: "가격, 영업시간, 대기 정보는 변경될 수 있으니 방문 전 다시 확인하세요.",
    },
  },
} as const;

export function getPlaceContent(place: PlaceWithRelations, locale: Locale) {
  const translation = place.translations?.find((item) => item.locale === locale);

  return {
    name: translation?.name || (locale === "ko" ? place.name_ko : place.name_zh),
    secondaryName: locale === "ko" ? place.name_zh : place.name_ko,
    description:
      translation?.description || (locale === "ko" ? place.short_description_ko : place.short_description_zh),
    travelTip: translation?.travel_tip || (locale === "ko" ? place.tips_ko : place.tips_zh),
    address: locale === "ko" ? place.address_ko : place.address_zh || place.address_ko,
    waitingInfo: locale === "ko" ? place.waiting_info_ko : place.waiting_info_zh,
    recommendedOrder: locale === "ko" ? place.recommended_order_ko : place.recommended_order_zh,
  };
}
