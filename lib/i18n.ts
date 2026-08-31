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
      mypage: "我的",
      submit: "提交地点",
      admin: "管理",
    },
    auth: {
      login: "登录",
      logout: "退出登录",
      mypage: "我的页面",
      admin: "管理",
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
      submitPlace: "提交地点",
      explorePlaces: "浏览地点",
      loading: "Loading...",
      notSubmittedYet: "还没有提交地点。",
    },
    home: {
      title: "釜山广安里旅行助手｜美食、拍照、行李寄存",
      description: "为中国自由行游客整理釜山广安里美食地图、拍照机位、韩语沟通、行李寄存和旅行路线。",
      area: "当前区域 · 广安里",
      heading: "釜山怎么玩？",
      subheading: "韩国本地人帮你整理好了。",
      supporting: "围绕广安里美食、拍照、行李寄存和短路线整理。",
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
      noMenu: "暂无菜单。",
      howToSay: "怎么说？",
      waiting: "等候",
      directions: "怎么去？",
      travelTip: "旅行小贴士",
      payment: "付款",
      coordinates: "坐标",
      location: "位置",
      distanceFromYou: "距离你",
      walkingApprox: "步行约",
      calculateDistance: "计算距离",
      confirmationNote: "价格、营业时间和等待信息可能会变化，请出发前再次确认。",
    },
    submissions: {
      title: "提交地点",
      myTitle: "我的提交",
      description: "提交地图链接和推荐理由，管理员审核后会补全地点信息。",
      loginDescription: "登录后可以提交地点并查看审核状态。",
      mapUrl: "地图链接",
      name: "地点名称",
      category: "分类",
      address: "地址或位置",
      descriptionLabel: "地点说明",
      reason: "推荐理由",
      imageUrl: "照片或图片 URL",
      notes: "其他参考",
      optional: "选填",
      submit: "提交",
      submitted: "已提交。管理员审核后会反映到服务中。",
      empty: "还没有提交地点。",
      status: {
        pending: "待审核",
        reviewing: "审核中",
        approved: "已通过",
        rejected: "已拒绝",
        duplicate: "重复",
      },
    },
    mypage: {
      title: "我的页面",
      subtitle: "个人资料、收藏和地点提交",
      profile: "个人资料",
      email: "邮箱",
      nickname: "昵称",
      joinedAt: "加入日期",
      role: "权限",
      savedPlaces: "收藏地点",
      savedEmptyTitle: "还没有收藏地点",
      savedEmptyDescription: "浏览地点并点保存后会显示在这里。",
      removeSaved: "取消保存",
      mySubmissions: "我的地点提交",
      settingsUnavailable: "资料修改功能将在数据库字段确认后开放。",
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
      mypage: "My Page",
      submit: "Submit",
      admin: "Admin",
    },
    auth: {
      login: "Login",
      logout: "Logout",
      mypage: "My Page",
      admin: "Admin",
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
      submitPlace: "Submit a place",
      explorePlaces: "Explore places",
      loading: "Loading...",
      notSubmittedYet: "No place submissions yet.",
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
    submissions: {
      title: "Submit a place",
      myTitle: "My submissions",
      description: "Send a map link and recommendation. Admins review it before publishing.",
      loginDescription: "Sign in to submit places and check review status.",
      mapUrl: "Map URL",
      name: "Place name",
      category: "Category",
      address: "Address or location",
      descriptionLabel: "Place description",
      reason: "Why recommend it",
      imageUrl: "Photo or image URL",
      notes: "Other notes",
      optional: "Optional",
      submit: "Submit",
      submitted: "Submitted. Admins will review it before publishing.",
      empty: "No place submissions yet.",
      status: {
        pending: "Pending",
        reviewing: "Reviewing",
        approved: "Approved",
        rejected: "Rejected",
        duplicate: "Duplicate",
      },
    },
    mypage: {
      title: "My Page",
      subtitle: "Profile, saved places, and submissions",
      profile: "Profile",
      email: "Email",
      nickname: "Nickname",
      joinedAt: "Joined",
      role: "Role",
      savedPlaces: "Saved places",
      savedEmptyTitle: "No saved places yet",
      savedEmptyDescription: "Save places while browsing and they will appear here.",
      removeSaved: "Unsave",
      mySubmissions: "My submissions",
      settingsUnavailable: "Profile editing will be enabled after confirming writable profile fields.",
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
      mypage: "マイページ",
      submit: "投稿",
      admin: "管理",
    },
    auth: {
      login: "ログイン",
      logout: "ログアウト",
      mypage: "マイページ",
      admin: "管理",
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
      submitPlace: "スポット投稿",
      explorePlaces: "スポットを見る",
      loading: "Loading...",
      notSubmittedYet: "投稿したスポットはまだありません。",
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
    submissions: {
      title: "スポット投稿",
      myTitle: "自分の投稿",
      description: "地図リンクとおすすめ理由を送ると、管理者が確認して掲載します。",
      loginDescription: "ログインするとスポット投稿と審査状況の確認ができます。",
      mapUrl: "地図リンク",
      name: "スポット名",
      category: "カテゴリ",
      address: "住所または位置",
      descriptionLabel: "スポット説明",
      reason: "おすすめ理由",
      imageUrl: "写真または画像 URL",
      notes: "その他メモ",
      optional: "任意",
      submit: "送信",
      submitted: "送信しました。管理者が確認してから掲載します。",
      empty: "投稿したスポットはまだありません。",
      status: {
        pending: "審査待ち",
        reviewing: "確認中",
        approved: "承認",
        rejected: "却下",
        duplicate: "重複",
      },
    },
    mypage: {
      title: "マイページ",
      subtitle: "プロフィール、保存スポット、投稿",
      profile: "プロフィール",
      email: "メール",
      nickname: "ニックネーム",
      joinedAt: "登録日",
      role: "権限",
      savedPlaces: "保存したスポット",
      savedEmptyTitle: "保存したスポットはまだありません",
      savedEmptyDescription: "スポットを保存するとここに表示されます。",
      removeSaved: "保存解除",
      mySubmissions: "自分の投稿",
      settingsUnavailable: "プロフィール編集は書き込み可能な項目を確認後に対応します。",
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
      mypage: "마이",
      submit: "제보",
      admin: "관리자",
    },
    auth: {
      login: "로그인",
      logout: "로그아웃",
      mypage: "마이페이지",
      admin: "관리자",
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
      submitPlace: "장소 제보하기",
      explorePlaces: "장소 둘러보기",
      loading: "로딩 중...",
      notSubmittedYet: "아직 제보한 장소가 없습니다.",
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
    submissions: {
      title: "장소 제보",
      myTitle: "내 제보",
      description: "지도 링크와 추천 이유를 보내면 관리자가 검수 후 장소 정보를 완성합니다.",
      loginDescription: "로그인 후 장소를 제보하고 검수 상태를 확인할 수 있습니다.",
      mapUrl: "지도 링크",
      name: "장소명",
      category: "카테고리",
      address: "주소 또는 위치",
      descriptionLabel: "장소 설명",
      reason: "추천 이유",
      imageUrl: "사진 또는 이미지 URL",
      notes: "기타 참고사항",
      optional: "선택",
      submit: "접수",
      submitted: "제보가 접수되었습니다. 관리자가 검수 후 반영합니다.",
      empty: "아직 제보한 장소가 없습니다.",
      status: {
        pending: "검토 대기",
        reviewing: "검토 중",
        approved: "승인",
        rejected: "반려",
        duplicate: "중복",
      },
    },
    mypage: {
      title: "마이페이지",
      subtitle: "프로필, 저장한 장소, 장소 제보",
      profile: "프로필",
      email: "이메일",
      nickname: "닉네임",
      joinedAt: "가입일",
      role: "권한",
      savedPlaces: "저장한 장소",
      savedEmptyTitle: "아직 저장한 장소가 없습니다",
      savedEmptyDescription: "장소를 둘러보고 저장하면 여기에 표시됩니다.",
      removeSaved: "저장 해제",
      mySubmissions: "내가 제보한 장소",
      settingsUnavailable: "프로필 수정은 쓰기 가능한 DB 필드 확인 후 제공됩니다.",
    },
  },
} as const;

type LocalizedValue = Partial<Record<Locale, string | null | undefined>>;

export function getLocalizedValue(values: LocalizedValue, locale: Locale, fallbackLocale: Locale = "ko") {
  const preferred = values[locale]?.trim();

  if (preferred) {
    return preferred;
  }

  const fallback = values[fallbackLocale]?.trim();

  if (fallback) {
    return fallback;
  }

  return locales.map((item) => values[item]?.trim()).find(Boolean) ?? "";
}

export function getLocalizedField(place: PlaceWithRelations, field: "name" | "description" | "travelTip", locale: Locale) {
  const legacyValues = {
    name: {
      zh: place.name_zh,
      ko: place.name_ko,
    },
    description: {
      zh: place.short_description_zh,
      ko: place.short_description_ko,
    },
    travelTip: {
      zh: place.tips_zh,
      ko: place.tips_ko,
    },
  } satisfies Record<typeof field, LocalizedValue>;
  const translatedValues = place.translations?.reduce<LocalizedValue>((acc, translation) => {
    const value = field === "travelTip" ? translation.travel_tip : translation[field];
    acc[translation.locale] = value;
    return acc;
  }, {}) ?? {};

  return getLocalizedValue({ ...legacyValues[field], ...translatedValues }, locale);
}

export function getLocalizedTag(tag: { label_zh: string; label_ko: string }, locale: Locale) {
  return getLocalizedValue({ zh: tag.label_zh, ko: tag.label_ko }, locale);
}

export function getLocalizedMenuItem(
  item: { name_ko: string; name_zh: string; description_zh?: string },
  locale: Locale,
) {
  const name = getLocalizedValue({ zh: item.name_zh, ko: item.name_ko }, locale);
  const secondaryName = locale === "ko" || name === item.name_ko ? "" : item.name_ko;

  return {
    name,
    secondaryName,
    description: locale === "zh" ? item.description_zh ?? "" : "",
  };
}

export function getPlaceContent(place: PlaceWithRelations, locale: Locale) {
  const name = getLocalizedField(place, "name", locale);
  const fallbackKoName = getLocalizedValue({ ko: place.name_ko }, "ko");

  const translatedAddresses = place.translations?.reduce<LocalizedValue>((acc, translation) => {
    if (translation.address?.trim()) acc[translation.locale] = translation.address;
    return acc;
  }, {}) ?? {};
  const localizedAddresses = { zh: place.address_zh, ko: place.address_ko, ...translatedAddresses };

  return {
    name,
    secondaryName: locale === "ko" || name === fallbackKoName ? "" : fallbackKoName,
    description: getLocalizedField(place, "description", locale),
    travelTip: getLocalizedField(place, "travelTip", locale),
    address: localizedAddresses[locale]?.trim() || "",
    waitingInfo: getLocalizedValue({ zh: place.waiting_info_zh, ko: place.waiting_info_ko }, locale),
    recommendedOrder: getLocalizedValue({ zh: place.recommended_order_zh, ko: place.recommended_order_ko }, locale),
  };
}
