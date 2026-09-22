import type { Locale } from "@/lib/i18n";
import type { PlaceFactTristate, PlaceWithRelations } from "@/types/database";

export type DecisionStatus = "verified" | "partially_verified" | "unverified" | "stale" | "conflicting";

export type PracticalFact = {
  key: string;
  label: string;
  value: string;
  status: PlaceFactTristate;
};

const copy = {
  ko: {
    title: "30초 방문 결정", worth: "일부러 갈 가치", unknownWorth: "확인된 정보 부족",
    recommend: "추천", notRecommend: "비추천", warning: "가기 전 주의", practical: "외국인 실용정보",
    difficulty: "이용 난이도", foreigner: "외국인", solo: "혼자", order: "주문",
    easy: "쉬움", normal: "보통", hard: "어려움", unknown: "미확인", yes: "가능", no: "불가",
    evidence: "확인 근거", operator: "확인 근거", traveler: "여행자 확인", checked: "확인",
  },
  zh: {
    title: "30秒到访判断", worth: "值得专程去吗", unknownWorth: "已确认的信息不足",
    recommend: "适合", notRecommend: "不太适合", warning: "去之前先看", practical: "外国游客实用信息",
    difficulty: "使用难度", foreigner: "外国游客", solo: "一个人", order: "点餐",
    easy: "容易", normal: "一般", hard: "较难", unknown: "未确认", yes: "支持", no: "不支持",
    evidence: "确认依据", operator: "确认依据", traveler: "旅行者确认", checked: "确认",
  },
  en: {
    title: "30-second visit check", worth: "Worth a detour", unknownWorth: "Not enough verified information",
    recommend: "Good for", notRecommend: "Not ideal for", warning: "Know before you go", practical: "Practical information",
    difficulty: "Difficulty", foreigner: "For visitors", solo: "Solo visit", order: "Ordering",
    easy: "Easy", normal: "Moderate", hard: "Hard", unknown: "Unknown", yes: "Available", no: "Unavailable",
    evidence: "Evidence", operator: "evidence items", traveler: "traveler checks", checked: "checked",
  },
  ja: {
    title: "30秒で訪問判断", worth: "わざわざ行く価値", unknownWorth: "確認済み情報が不足",
    recommend: "おすすめ", notRecommend: "不向き", warning: "行く前の注意", practical: "外国人向け実用情報",
    difficulty: "利用難易度", foreigner: "外国人", solo: "一人", order: "注文",
    easy: "簡単", normal: "普通", hard: "難しい", unknown: "未確認", yes: "利用可", no: "利用不可",
    evidence: "確認根拠", operator: "確認根拠", traveler: "旅行者確認", checked: "確認",
  },
} satisfies Record<Locale, Record<string, string>>;

const themeLabels: Record<string, Record<Locale, string>> = {
  first_trip: { ko: "부산 첫 여행", zh: "第一次来釜山", en: "First trip", ja: "釜山初旅行" },
  solo: { ko: "혼자", zh: "一个人", en: "Solo", ja: "一人旅" },
  couple: { ko: "커플", zh: "情侣", en: "Couples", ja: "カップル" },
  parents: { ko: "부모님과", zh: "带父母", en: "With parents", ja: "両親と" },
  rainy_day: { ko: "비 오는 날", zh: "雨天", en: "Rainy day", ja: "雨の日" },
  food_trip: { ko: "먹방", zh: "美食之旅", en: "Food trip", ja: "グルメ旅" },
  photo_trip: { ko: "사진", zh: "拍照", en: "Photos", ja: "写真" },
  cafe_trip: { ko: "카페", zh: "咖啡店", en: "Cafe trip", ja: "カフェ巡り" },
  night_view: { ko: "야경", zh: "夜景", en: "Night view", ja: "夜景" },
  low_walking: { ko: "적게 걷기", zh: "少走路", en: "Low walking", ja: "歩行少なめ" },
  luggage_day: { ko: "캐리어 동반", zh: "带行李", en: "With luggage", ja: "荷物あり" },
  late_night: { ko: "늦은 밤", zh: "深夜", en: "Late night", ja: "深夜" },
  two_nights_three_days: { ko: "2박 3일", zh: "3天2晚", en: "3 days / 2 nights", ja: "2泊3日" },
  gwangalli_half_day: { ko: "광안리 반나절", zh: "广安里半日", en: "Gwangalli half day", ja: "広安里半日" },
  haeundae_three_hours: { ko: "해운대 3시간", zh: "海云台3小时", en: "Haeundae in 3 hours", ja: "海雲台3時間" },
};

const practicalLabels: Record<string, Record<Locale, string>> = {
  foreign_card: { ko: "해외카드", zh: "海外信用卡", en: "Foreign card", ja: "海外カード" },
  alipay: { ko: "알리페이", zh: "支付宝", en: "Alipay", ja: "Alipay" },
  wechat_pay: { ko: "위챗페이", zh: "微信支付", en: "WeChat Pay", ja: "WeChat Pay" },
  chinese_menu: { ko: "중국어 메뉴", zh: "中文菜单", en: "Chinese menu", ja: "中国語メニュー" },
  english_menu: { ko: "영어 메뉴", zh: "英文菜单", en: "English menu", ja: "英語メニュー" },
  kiosk: { ko: "키오스크 언어", zh: "自助机语言", en: "Kiosk languages", ja: "キオスク言語" },
  solo: { ko: "혼자 방문", zh: "一个人", en: "Solo visit", ja: "一人利用" },
  luggage: { ko: "캐리어", zh: "大行李箱", en: "Large luggage", ja: "大型荷物" },
  storage: { ko: "짐 보관", zh: "行李寄存", en: "Luggage storage", ja: "荷物預かり" },
  restroom: { ko: "화장실", zh: "店内厕所", en: "Restroom", ja: "トイレ" },
  reservation: { ko: "예약", zh: "预约", en: "Reservation", ja: "予約" },
  minimum: { ko: "최소 주문", zh: "最低点餐", en: "Minimum order", ja: "最低注文" },
  elevator: { ko: "엘리베이터", zh: "电梯", en: "Elevator", ja: "エレベーター" },
  wheelchair: { ko: "휠체어", zh: "轮椅", en: "Wheelchair", ja: "車いす" },
  stroller: { ko: "유모차", zh: "婴儿车", en: "Stroller", ja: "ベビーカー" },
};

const warningLabels = {
  chineseMenu: { ko: "중국어 메뉴 없음", zh: "无中文菜单", en: "No Chinese menu", ja: "中国語メニューなし" },
  kioskKorean: { ko: "키오스크 한국어만 지원", zh: "自助机仅支持韩语", en: "Kiosk is Korean-only", ja: "キオスクは韓国語のみ" },
  longWait: { ko: "웨이팅이 길 수 있음", zh: "可能需要长时间等位", en: "Long waits are possible", ja: "長時間待つ場合あり" },
  luggage: { ko: "캐리어 두기 어려움", zh: "大行李箱放置困难", en: "Large luggage may be difficult", ja: "大型荷物は置きにくい" },
  restroom: { ko: "매장 화장실 없음", zh: "店内无厕所", en: "No in-store restroom", ja: "店内トイレなし" },
  cardUnknown: { ko: "해외카드 사용 여부 미확인", zh: "海外信用卡尚未确认", en: "Foreign card acceptance unconfirmed", ja: "海外カード利用は未確認" },
  reservation: { ko: "예약 필요", zh: "需要预约", en: "Reservation required", ja: "予約が必要" },
  elevator: { ko: "엘리베이터 없음", zh: "无电梯", en: "No elevator", ja: "エレベーターなし" },
  sellout: { ko: "특정 시간 품절 위험", zh: "特定时段可能售罄", en: "Sellout risk at some times", ja: "時間帯により売切れの可能性" },
} satisfies Record<string, Record<Locale, string>>;

export function getDecisionCopy(locale: Locale) {
  return copy[locale];
}

export function getLocalizedDecisionText(value: Partial<Record<Locale, string>> | null | undefined, locale: Locale) {
  return value?.[locale]?.trim() ?? "";
}

export function getThemeLabels(values: string[] | null | undefined, locale: Locale, limit = values?.length ?? 0) {
  return (values ?? []).map((value) => themeLabels[value]?.[locale]).filter((value): value is string => Boolean(value)).slice(0, limit);
}

export function getWorthLabel(place: PlaceWithRelations, locale: Locale) {
  const labels = {
    nearby_only: { ko: "근처라면 방문", zh: "顺路可去", en: "Only if nearby", ja: "近くなら訪問" },
    worth_short_detour: { ko: "짧게 우회할 가치 있음", zh: "值得稍微绕路", en: "Worth a short detour", ja: "少し寄り道する価値あり" },
    worth_long_detour: { ko: "멀리서 찾아갈 가치 있음", zh: "值得专程前往", en: "Worth a longer detour", ja: "遠くから行く価値あり" },
    destination: { ko: "여행 목적지로 추천", zh: "可作为旅行目的地", en: "Worth making a destination", ja: "旅の目的地におすすめ" },
  } as const;
  const level = place.decision_profile?.worth_detour_level;
  return level ? labels[level][locale] : copy[locale].unknownWorth;
}

export function getDecisionStatus(place: PlaceWithRelations): DecisionStatus {
  const decision = place.decision_profile?.verification_status;
  if (decision === "verified" || decision === "partially_verified" || decision === "stale" || decision === "conflicting") return decision;
  const legacy = place.china_info?.verification_status;
  if (place.china_info?.has_information_conflict) return "conflicting";
  if (legacy === "verified") return "verified";
  if (legacy === "needs_review") return "partially_verified";
  return "unverified";
}

export function getDecisionStatusLabel(status: DecisionStatus, locale: Locale) {
  return {
    verified: { ko: "검수 완료", zh: "已审核", en: "Verified", ja: "確認済み" },
    partially_verified: { ko: "일부 검수", zh: "部分已确认", en: "Partly verified", ja: "一部確認済み" },
    unverified: { ko: "아직 확인되지 않음", zh: "尚未确认", en: "Not yet verified", ja: "未確認" },
    stale: { ko: "오래된 정보", zh: "信息较旧", en: "Information may be stale", ja: "古い情報" },
    conflicting: { ko: "정보 충돌", zh: "信息存在冲突", en: "Conflicting information", ja: "情報に不一致" },
  }[status][locale];
}

export function getDecisionWarnings(place: PlaceWithRelations, locale: Locale) {
  const info = place.china_info;
  const warnings: string[] = [];
  const primary = getLocalizedDecisionText(place.decision_profile?.primary_warning, locale);
  if (primary) warnings.push(primary);
  if (info?.minimum_order_policy === "two_plus") warnings.push(minimumPeopleLabel(2, locale));
  if (info?.minimum_order_policy === "three_plus") warnings.push(minimumPeopleLabel(3, locale));
  if (info?.minimum_order_people && info.minimum_order_people > 1) warnings.push(minimumPeopleLabel(info.minimum_order_people, locale));
  if (info?.chinese_menu === "no") warnings.push(warningLabels.chineseMenu[locale]);
  const kiosk = info?.kiosk_language_support;
  if (kiosk?.status === "yes" && kiosk.languages.length > 0 && kiosk.languages.every((language) => language.toLowerCase() === "ko")) warnings.push(warningLabels.kioskKorean[locale]);
  if (info?.waiting_level === "long" || info?.waiting_level === "extreme") warnings.push(warningLabels.longWait[locale]);
  if (info?.luggage_friendly === "no") warnings.push(warningLabels.luggage[locale]);
  if (info?.toilet_available === "no") warnings.push(warningLabels.restroom[locale]);
  if (info?.foreign_card === "unknown") warnings.push(warningLabels.cardUnknown[locale]);
  if (info?.reservation_required === "yes") warnings.push(warningLabels.reservation[locale]);
  if (info?.elevator === "no") warnings.push(warningLabels.elevator[locale]);
  if (Object.values(place.operating_profile?.sellout_risk_by_hour ?? {}).some((risk) => typeof risk === "number" && risk >= 4)) warnings.push(warningLabels.sellout[locale]);
  return Array.from(new Set(warnings));
}

export function getPracticalFacts(place: PlaceWithRelations, locale: Locale): PracticalFact[] {
  const info = place.china_info;
  const insights = info?.traveler_insights;
  const tri = (key: keyof typeof practicalLabels, status: PlaceFactTristate, custom?: string): PracticalFact => ({
    key, label: practicalLabels[key][locale], status, value: custom || triStateLabel(status, locale),
  });
  const kiosk = info?.kiosk_language_support;
  const minimumPeople = info?.minimum_order_people ?? (info?.minimum_order_policy === "two_plus" ? 2 : info?.minimum_order_policy === "three_plus" ? 3 : null);
  const minimumValue = minimumPeople
    ? minimumPeopleLabel(minimumPeople, locale)
    : info?.minimum_order_amount
      ? `${formatWon(info.minimum_order_amount)}+`
      : info?.minimum_order_policy === "none"
        ? { ko: "제한 없음", zh: "无限制", en: "No minimum", ja: "制限なし" }[locale]
        : copy[locale].unknown;
  const minimumStatus: PlaceFactTristate = info?.minimum_order_policy === "none" ? "yes" : minimumPeople || info?.minimum_order_amount ? "no" : "unknown";

  return [
    tri("foreign_card", withLegacyTrue(info?.foreign_card, place.card_payment)),
    tri("alipay", info?.alipay ?? "unknown"),
    tri("wechat_pay", info?.wechat_pay ?? "unknown"),
    tri("chinese_menu", withLegacyTrue(info?.chinese_menu, place.chinese_menu)),
    tri("english_menu", insights?.english_menu ?? "unknown"),
    tri("kiosk", kiosk?.status ?? "unknown", kiosk?.status === "yes" && kiosk.languages.length ? kiosk.languages.map((item) => item.toUpperCase()).join(" / ") : undefined),
    tri("solo", withLegacyTrue(info?.solo_friendly, place.solo_friendly)),
    tri("luggage", withLegacyTrue(info?.luggage_friendly, place.luggage_friendly)),
    tri("storage", insights?.luggage_storage ?? "unknown"),
    tri("restroom", info?.toilet_available ?? toiletToTriState(insights?.toilet)),
    reservationFact(info?.reservation_required, insights?.reservation, locale),
    tri("minimum", minimumStatus, minimumValue),
    tri("elevator", info?.elevator ?? "unknown"),
    tri("wheelchair", info?.wheelchair_access ?? "unknown"),
    tri("stroller", info?.stroller_friendly ?? "unknown"),
  ];
}

export function getDifficultyLabel(value: number | null | undefined, locale: Locale) {
  if (typeof value !== "number") return copy[locale].unknown;
  if (value <= 2) return copy[locale].easy;
  if (value <= 3) return copy[locale].normal;
  return copy[locale].hard;
}

export function getDecisionEvidence(place: PlaceWithRelations, locale: Locale) {
  const operatorCount = place.decision_profile?.evidence_count ?? 0;
  const travelerCount = place.china_info?.traveler_confirmation_count ?? 0;
  const date = place.decision_profile?.last_verified_at ?? place.china_info?.verified_at ?? place.last_verified_at;
  const values: string[] = [];
  if (operatorCount > 0) values.push(`${copy[locale].operator} ${operatorCount}`);
  if (travelerCount > 0) values.push(`${copy[locale].traveler} ${travelerCount}`);
  if (date) values.push(`${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(date))} ${copy[locale].checked}`);
  return values;
}

function triStateLabel(status: PlaceFactTristate, locale: Locale) {
  return status === "yes" ? copy[locale].yes : status === "no" ? copy[locale].no : copy[locale].unknown;
}

function withLegacyTrue(status: PlaceFactTristate | undefined, legacy: boolean): PlaceFactTristate {
  return status ?? (legacy ? "yes" : "unknown");
}

function toiletToTriState(value: string | undefined): PlaceFactTristate {
  if (value === "available" || value === "inside") return "yes";
  if (value === "none") return "no";
  return "unknown";
}

function reservationStatus(value: PlaceFactTristate | undefined, legacy: string | undefined): PlaceFactTristate {
  if (value) return value;
  if (legacy === "required" || legacy === "recommended") return "yes";
  if (legacy === "not_needed") return "no";
  return "unknown";
}

function reservationFact(value: PlaceFactTristate | undefined, legacy: string | undefined, locale: Locale): PracticalFact {
  const status = reservationStatus(value, legacy);
  const label = practicalLabels.reservation[locale];
  if (status === "yes") return { key: "reservation", label, status: "no", value: { ko: "필요", zh: "需要", en: "Required", ja: "必要" }[locale] };
  if (status === "no") return { key: "reservation", label, status: "yes", value: { ko: "불필요", zh: "不需要", en: "Not required", ja: "不要" }[locale] };
  return { key: "reservation", label, status, value: copy[locale].unknown };
}

function minimumPeopleLabel(people: number, locale: Locale) {
  return {
    ko: `${people}인분부터 주문`, zh: `${people}人份起点`, en: `Minimum ${people} portions`, ja: `${people}人前から注文`,
  }[locale];
}

function formatWon(value: number) {
  return `₩${value.toLocaleString("ko-KR")}`;
}
