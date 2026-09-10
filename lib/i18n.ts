import type { Metadata } from "next";
import { absoluteUrl } from "@/config/site";
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

export function localeAlternates(path: string): Record<string, string> {
  const basePath = withoutLocale(path);
  const languages = locales.reduce<Record<string, string>>((acc, locale) => {
    acc[localeMeta[locale].languageTag] = absoluteUrl(withLocale(basePath, locale));
    return acc;
  }, {});

  languages["x-default"] = absoluteUrl(withLocale(basePath, defaultLocale));

  return languages;
}

export function localizedCanonical(path: string, locale: Locale) {
  return absoluteUrl(withLocale(withoutLocale(path), locale));
}

export function localizedTitle(title: string, locale: Locale) {
  const siteName = ui[locale].siteName;
  return title.includes(siteName) ? title : `${title} | ${siteName}`;
}

type LocalizedMetadataOptions = {
  title: string;
  description: string;
  path: string;
  locale: Locale;
  type?: "website" | "article";
  noIndex?: boolean;
  follow?: boolean;
  images?: NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;
};

export function buildLocalizedMetadata({
  title,
  description,
  path,
  locale,
  type = "website",
  noIndex = false,
  follow = true,
  images,
}: LocalizedMetadataOptions): Metadata {
  const url = localizedCanonical(path, locale);
  const fullTitle = localizedTitle(title, locale);

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
      languages: localeAlternates(path),
    },
    robots: noIndex ? { index: false, follow } : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: ui[locale].siteName,
      locale: localeMeta[locale].openGraphLocale,
      type,
      images,
    },
    twitter: {
      card: "summary",
      title: fullTitle,
      description,
      images,
    },
    appleWebApp: {
      capable: true,
      title: ui[locale].siteName,
      statusBarStyle: "default",
    },
  };
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
    siteName: "韩国旅行助手",
    siteDescription: "面向中国自由行游客的釜山广安里 Beta 旅行工具，整理已确认的美食、拍照机位、行李寄存、韩语沟通和旅行路线。",
    region: "釜山广安里 Beta",
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
      registeredPlaces: "已登记地点",
      sampleData: "示例数据",
      backToPlaces: "返回附近推荐",
      unavailable: "暂未开放",
      available: "现在可查看",
      noInfo: "信息确认中",
      notRegistered: "信息确认中",
      free: "免费",
      priceUnknown: "价格确认中",
      walk: "步行",
      minutes: "分钟",
      perPerson: "人均预计",
      openMap: "打开地图",
      submitPlace: "提交地点",
      explorePlaces: "浏览地点",
      loading: "Loading...",
      notSubmittedYet: "还没有提交地点。",
    },
    home: {
      title: "釜山自由行攻略｜美食、路线、下雨天和行李寄存",
      description: "按旅行问题查釜山：广安里美食、第一次去怎么玩、下雨天去哪、行李寄存、中文菜单餐厅和官方路线。",
      area: "当前区域 · 广安里 Beta",
      areaAction: "更换区域",
      areaNote: "目前只公开已确认的广安里周边地点。其他区域验证完成后再开放。",
      heading: "先找到要去的店，再保存进路线。",
      subheading: "为中国自由行游客整理的广安里 Beta。",
      supporting: "搜索、比较、查看详情、收藏，再把收藏地点加入行程。没有确认的数据不会用示例地点补齐。",
      recommended: "已验证的本地推荐",
      recommendedSubtitle: "从已公开地点中按推荐与收藏优先显示。",
      searchLabel: "搜索广安里地点",
      searchButton: "搜索",
      searchPlaceholder: "搜索美食、咖啡、拍照、行李",
      quickFiltersTitle: "按现在的情况找",
      quickFiltersSubtitle: "只有已有地点数据可判断的条件才可点击。",
      quickFilterUnavailable: "需要更多已确认地点后开放",
      quickFilters: {
        openNow: "现在营业",
        lowWait: "少排队",
        solo: "一个人OK",
        under10000: "₩10,000以内",
        oceanView: "海景",
        rainyDay: "雨天也适合",
        luggage: "行李箱OK",
        subwayWalk10: "地铁10分钟内",
        chineseMenu: "中文菜单",
      },
      emptyRecommendationTitle: "正在整理可公开的地点",
      emptyRecommendationDescription: "地点通过管理员验证后才会显示。不会因为数据不足而生成假推荐。",
      itineraryTitle: "用收藏地点生成行程",
      itineraryDescription: "先保存想去的地点，再按日期安排路线和访问顺序。",
      itineraryCta: "整理我的行程",
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
      categoryPlaceholder: "选择分类",
      address: "地址或位置",
      descriptionLabel: "地点说明",
      reason: "推荐理由",
      imageUrl: "照片或图片 URL",
      notes: "其他参考",
      optional: "补充信息",
      submit: "提交",
      submitted: "已提交。管理员审核后会反映到服务中。",
      submitFailed: "提交失败。请稍后再试。",
      loadFailed: "无法加载提交记录。请稍后再试。",
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
      subtitle: "个人资料、我的釜山清单和地点提交",
      profile: "个人资料",
      email: "邮箱",
      nickname: "昵称",
      joinedAt: "加入日期",
      role: "权限",
      savedPlaces: "我的釜山清单",
      savedEmptyTitle: "还没有收藏地点",
      savedEmptyDescription: "浏览地点或官方路线并点收藏后会显示在这里。",
      removeSaved: "取消保存",
      mySubmissions: "我的地点提交",
      settingsUnavailable: "资料修改功能将在数据库字段确认后开放。",
    },
  },
  en: {
    siteName: "Korea Travel Assistant",
    siteDescription: "A Busan Gwangalli beta travel tool for independent Chinese travelers, covering verified food, photo spots, luggage storage, Korean phrases, and routes.",
    region: "Busan Gwangalli Beta",
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
      registeredPlaces: "Registered places",
      sampleData: "Sample data",
      backToPlaces: "Back to places",
      unavailable: "Unavailable",
      available: "Available",
      noInfo: "Needs checking",
      notRegistered: "Needs checking",
      free: "Free",
      priceUnknown: "Price needs checking",
      walk: "Walk",
      minutes: "min",
      perPerson: "Est. per person",
      openMap: "Open map",
      submitPlace: "Submit a place",
      explorePlaces: "Explore places",
      loading: "Loading...",
      notSubmittedYet: "No place submissions yet.",
    },
    home: {
      title: "Busan Travel Assistant | Food, Routes, Rainy Day, Luggage",
      description: "Find Busan guides connected to verified places: Gwangalli food, first-time routes, rainy day ideas, luggage storage, Chinese-menu restaurants, and official courses.",
      area: "Current area · Gwangalli Beta",
      areaAction: "Change area",
      areaNote: "Only verified places around Gwangalli are public for now. More areas will open after review.",
      heading: "Find places first, then save them into a route.",
      subheading: "A Gwangalli beta for independent Chinese travelers.",
      supporting: "Search, compare, check details, save places, and add saved places to an itinerary. Missing data is not replaced with sample places.",
      recommended: "Verified local picks",
      recommendedSubtitle: "Shown from published places, prioritizing featured and saved places.",
      searchLabel: "Search Gwangalli places",
      searchButton: "Search",
      searchPlaceholder: "Search food, cafes, photos, luggage",
      quickFiltersTitle: "Search by situation",
      quickFiltersSubtitle: "Only filters backed by available place data are clickable.",
      quickFilterUnavailable: "Available after more verified places are added",
      quickFilters: {
        openNow: "Open now",
        lowWait: "Short wait",
        solo: "Solo OK",
        under10000: "Under ₩10k",
        oceanView: "Ocean view",
        rainyDay: "Rainy day",
        luggage: "Luggage OK",
        subwayWalk10: "10 min to subway",
        chineseMenu: "Chinese menu",
      },
      emptyRecommendationTitle: "Verified places are being prepared",
      emptyRecommendationDescription: "Places appear only after admin review. The service does not create fake recommendations when data is missing.",
      itineraryTitle: "Build a route from saved places",
      itineraryDescription: "Save places you want to visit, then arrange them by day and visit order.",
      itineraryCta: "Plan my itinerary",
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
      categoryPlaceholder: "Select a category",
      address: "Address or location",
      descriptionLabel: "Place description",
      reason: "Why recommend it",
      imageUrl: "Photo or image URL",
      notes: "Other notes",
      optional: "Additional details",
      submit: "Submit",
      submitted: "Submitted. Admins will review it before publishing.",
      submitFailed: "Submission failed. Please try again later.",
      loadFailed: "Could not load submissions. Please try again later.",
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
      subtitle: "Profile, My Busan list, and submissions",
      profile: "Profile",
      email: "Email",
      nickname: "Nickname",
      joinedAt: "Joined",
      role: "Role",
      savedPlaces: "My Busan list",
      savedEmptyTitle: "No saved places yet",
      savedEmptyDescription: "Save places or official courses while browsing and they will appear here.",
      removeSaved: "Unsave",
      mySubmissions: "My submissions",
      settingsUnavailable: "Profile editing will be enabled after confirming writable profile fields.",
    },
  },
  ja: {
    siteName: "韓国旅行アシスタント",
    siteDescription: "中国からの個人旅行者向けに、釜山・広安里 Beta の確認済みグルメ、写真スポット、荷物預かり、韓国語フレーズ、旅程をまとめた旅行ツール。",
    region: "釜山・広安里 Beta",
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
      registeredPlaces: "登録済みスポット",
      sampleData: "サンプルデータ",
      backToPlaces: "スポット一覧へ",
      unavailable: "未公開",
      available: "閲覧可能",
      noInfo: "確認中",
      notRegistered: "確認中",
      free: "無料",
      priceUnknown: "価格確認中",
      walk: "徒歩",
      minutes: "分",
      perPerson: "1人目安",
      openMap: "地図を開く",
      submitPlace: "スポット投稿",
      explorePlaces: "スポットを見る",
      loading: "Loading...",
      notSubmittedYet: "投稿したスポットはまだありません。",
    },
    home: {
      title: "釜山旅行アシスタント｜グルメ、コース、雨の日、荷物預かり",
      description: "釜山の旅行課題別に、広安里グルメ、初めてのルート、雨の日、荷物預かり、中国語メニュー対応店、公式コースを探せます。",
      area: "現在のエリア · 広安里 Beta",
      areaAction: "エリア変更",
      areaNote: "現在は広安里周辺の確認済みスポットのみ公開しています。他エリアは確認後に公開します。",
      heading: "行きたい場所を見つけて、ルートに保存。",
      subheading: "中国からの個人旅行者向け広安里 Beta。",
      supporting: "検索、比較、詳細確認、保存、保存スポットから旅程作成までつなげます。未確認データをサンプルで補完しません。",
      recommended: "確認済みの現地おすすめ",
      recommendedSubtitle: "公開済みスポットから、おすすめと保存数を優先して表示します。",
      searchLabel: "広安里スポット検索",
      searchButton: "検索",
      searchPlaceholder: "グルメ、カフェ、写真、荷物を検索",
      quickFiltersTitle: "今の状況で探す",
      quickFiltersSubtitle: "利用可能なスポットデータで判定できる条件だけ選択できます。",
      quickFilterUnavailable: "確認済みスポットが増えると利用できます",
      quickFilters: {
        openNow: "現在営業中",
        lowWait: "待ち少なめ",
        solo: "一人OK",
        under10000: "1万ウォン以下",
        oceanView: "海が見える",
        rainyDay: "雨の日向き",
        luggage: "荷物OK",
        subwayWalk10: "駅10分以内",
        chineseMenu: "中国語メニュー",
      },
      emptyRecommendationTitle: "公開できるスポットを確認中です",
      emptyRecommendationDescription: "管理者確認後のスポットだけ表示します。データ不足を理由に架空のおすすめは作成しません。",
      itineraryTitle: "保存スポットから旅程作成",
      itineraryDescription: "行きたいスポットを保存して、日付と訪問順に整理できます。",
      itineraryCta: "旅程を整理",
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
      categoryPlaceholder: "カテゴリを選択",
      address: "住所または位置",
      descriptionLabel: "スポット説明",
      reason: "おすすめ理由",
      imageUrl: "写真または画像 URL",
      notes: "その他メモ",
      optional: "追加情報",
      submit: "送信",
      submitted: "送信しました。管理者が確認してから掲載します。",
      submitFailed: "送信できませんでした。時間をおいて再度お試しください。",
      loadFailed: "投稿を読み込めませんでした。時間をおいて再度お試しください。",
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
      subtitle: "プロフィール、マイ釜山リスト、投稿",
      profile: "プロフィール",
      email: "メール",
      nickname: "ニックネーム",
      joinedAt: "登録日",
      role: "権限",
      savedPlaces: "マイ釜山リスト",
      savedEmptyTitle: "保存したスポットはまだありません",
      savedEmptyDescription: "スポットや公式コースを保存するとここに表示されます。",
      removeSaved: "保存解除",
      mySubmissions: "自分の投稿",
      settingsUnavailable: "プロフィール編集は書き込み可能な項目を確認後に対応します。",
    },
  },
  ko: {
    siteName: "한국 여행 어시스턴트",
    siteDescription: "중국인 자유여행객을 위해 부산 광안리 Beta의 검증된 맛집, 사진스팟, 짐보관, 한국어 안내 문장, 여행 코스를 정리한 여행 도구입니다.",
    region: "부산 광안리 Beta",
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
      registeredPlaces: "등록된 장소",
      sampleData: "예시 데이터",
      backToPlaces: "장소 목록으로",
      unavailable: "비공개",
      available: "조회 가능",
      noInfo: "정보 확인 필요",
      notRegistered: "정보 확인 필요",
      free: "무료",
      priceUnknown: "가격 확인 필요",
      walk: "도보",
      minutes: "분",
      perPerson: "1인 예상",
      openMap: "지도 열기",
      submitPlace: "장소 제보하기",
      explorePlaces: "장소 둘러보기",
      loading: "로딩 중...",
      notSubmittedYet: "아직 제보한 장소가 없습니다.",
    },
    home: {
      title: "부산 여행 어시스턴트 | 맛집, 코스, 비 오는 날, 짐보관",
      description: "광안리 맛집, 처음 가는 코스, 비 오는 날 여행, 짐 보관, 중국어 메뉴 식당, 공식 여행 코스를 실제 장소와 함께 찾습니다.",
      area: "현재 지역 · 광안리 Beta",
      areaAction: "지역 변경",
      areaNote: "현재는 광안리 주변의 검증된 장소만 공개합니다. 다른 지역은 확인이 끝난 뒤 열립니다.",
      heading: "갈 곳을 먼저 찾고, 일정에 저장하세요.",
      subheading: "중국인 자유여행객을 위한 광안리 Beta.",
      supporting: "검색, 비교, 상세 확인, 저장, 저장한 장소 기반 일정 만들기까지 이어집니다. 확인되지 않은 데이터는 예시 장소로 채우지 않습니다.",
      recommended: "검증된 현지 추천",
      recommendedSubtitle: "공개된 장소 중 추천 여부와 저장 수를 기준으로 보여줍니다.",
      searchLabel: "광안리 장소 검색",
      searchButton: "검색",
      searchPlaceholder: "맛집, 카페, 사진, 짐보관 검색",
      quickFiltersTitle: "상황별 빠른 필터",
      quickFiltersSubtitle: "실제 장소 데이터로 판정 가능한 조건만 선택할 수 있습니다.",
      quickFilterUnavailable: "검증된 장소 데이터가 더 쌓이면 사용할 수 있습니다",
      quickFilters: {
        openNow: "지금 영업 중",
        lowWait: "웨이팅 적음",
        solo: "혼밥 가능",
        under10000: "1만원 이하",
        oceanView: "바다 전망",
        rainyDay: "비 오는 날",
        luggage: "캐리어 가능",
        subwayWalk10: "지하철 10분 이내",
        chineseMenu: "중국어 메뉴",
      },
      emptyRecommendationTitle: "공개할 장소를 검수 중입니다",
      emptyRecommendationDescription: "관리자 검증을 통과한 장소만 표시합니다. 데이터가 부족하다는 이유로 가짜 추천을 만들지 않습니다.",
      itineraryTitle: "저장 장소로 일정 만들기",
      itineraryDescription: "가고 싶은 장소를 저장한 뒤 날짜와 방문 순서에 맞춰 정리하세요.",
      itineraryCta: "내 일정 정리하기",
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
      categoryPlaceholder: "카테고리를 선택해 주세요",
      address: "주소 또는 위치",
      descriptionLabel: "장소 설명",
      reason: "추천 이유",
      imageUrl: "사진 또는 이미지 URL",
      notes: "기타 참고사항",
      optional: "추가 정보",
      submit: "접수",
      submitted: "제보가 접수되었습니다. 관리자가 검수 후 반영합니다.",
      submitFailed: "제보 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      loadFailed: "제보 내역을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
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
      subtitle: "프로필, 나의 부산 리스트, 장소 제보",
      profile: "프로필",
      email: "이메일",
      nickname: "닉네임",
      joinedAt: "가입일",
      role: "권한",
      savedPlaces: "나의 부산 리스트",
      savedEmptyTitle: "아직 저장한 장소가 없습니다",
      savedEmptyDescription: "장소나 공식 코스를 둘러보고 저장하면 여기에 표시됩니다.",
      removeSaved: "저장 해제",
      mySubmissions: "내가 제보한 장소",
      settingsUnavailable: "프로필 수정은 쓰기 가능한 DB 필드 확인 후 제공됩니다.",
    },
  },
} as const;

type LocalizedValue = Partial<Record<Locale, string | null | undefined>>;

export function getExactLocalizedValue(values: LocalizedValue, locale: Locale) {
  return values[locale]?.trim() ?? "";
}

export function getLocalizedValue(values: LocalizedValue, locale: Locale, fallbackLocale: Locale = "ko") {
  const preferred = values[locale]?.trim();

  if (preferred) {
    return preferred;
  }

  // Never show another language on the Korean route when Korean content is missing.
  if (locale === "ko") {
    return "";
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
    if (value?.trim()) acc[translation.locale] = value;
    return acc;
  }, {}) ?? {};

  const values = { ...legacyValues[field], ...translatedValues };
  return field === "name" ? getLocalizedValue(values, locale) : getExactLocalizedValue(values, locale);
}

export function getLocalizedTag(tag: { label_zh: string; label_ko: string }, locale: Locale) {
  if (locale === "zh") return tag.label_zh.trim();
  if (locale === "ko") return tag.label_ko.trim();

  return "";
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
    waitingInfo: getExactLocalizedValue({ zh: place.waiting_info_zh, ko: place.waiting_info_ko }, locale),
    recommendedOrder: getExactLocalizedValue({ zh: place.recommended_order_zh, ko: place.recommended_order_ko }, locale),
  };
}

type DictionaryKeyDiff = {
  locale: Locale;
  missing: string[];
  extra: string[];
};

export function getLocaleDictionaryKeyDiffs() {
  const baseLocale: Locale = "ko";
  const baseKeys = flattenObjectKeys(ui[baseLocale]);

  return locales
    .filter((locale) => locale !== baseLocale)
    .map<DictionaryKeyDiff>((locale) => {
      const keys = flattenObjectKeys(ui[locale]);
      return {
        locale,
        missing: [...baseKeys].filter((key) => !keys.has(key)).sort(),
        extra: [...keys].filter((key) => !baseKeys.has(key)).sort(),
      };
    })
    .filter((diff) => diff.missing.length > 0 || diff.extra.length > 0);
}

export function warnMissingLocaleDictionaryKeys() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const diffs = getLocaleDictionaryKeyDiffs();
  if (!diffs.length) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn("[i18n] Locale dictionary key mismatch", diffs);
}

function flattenObjectKeys(value: unknown, prefix = ""): Set<string> {
  if (!isPlainObject(value)) {
    return new Set(prefix ? [prefix] : []);
  }

  const keys = new Set<string>();
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    flattenObjectKeys(child, path).forEach((item) => keys.add(item));
  });
  return keys;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

warnMissingLocaleDictionaryKeys();
