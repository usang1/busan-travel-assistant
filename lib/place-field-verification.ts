export const placeVerificationStatuses = [
  "unverified",
  "auto_imported",
  "online_verified",
  "owner_confirmed",
  "field_verified",
  "needs_recheck",
] as const;

export type PlaceFieldVerificationStatus = (typeof placeVerificationStatuses)[number];
export type PlaceFieldSourceType = "map_api" | "official_website" | "official_menu" | "owner" | "admin" | "field_visit" | "csv" | "manual";
export type PlaceVerificationApproval = "pending" | "approved" | "rejected";

export const managedPlaceFields = [
  "name", "address", "road_address", "coordinates", "phone", "category", "website",
  "map_link", "opening_hours", "operating_status", "menu", "menu_price", "parking",
  "reservation", "card_payment", "solo_friendly", "foreign_language", "waiting",
  "restroom", "accessibility", "taste", "portion", "spiciness", "greasiness",
] as const;

export type ManagedPlaceField = (typeof managedPlaceFields)[number];

export const placeFieldLabels: Record<ManagedPlaceField, string> = {
  name: "상호명", address: "지번 주소", road_address: "도로명 주소", coordinates: "위도·경도",
  phone: "전화번호", category: "카테고리", website: "공식 홈페이지", map_link: "지도 링크",
  opening_hours: "영업시간", operating_status: "실제 영업 여부", menu: "대표 메뉴",
  menu_price: "메뉴 가격", parking: "주차", reservation: "예약", card_payment: "카드 결제",
  solo_friendly: "혼밥", foreign_language: "외국어 메뉴·응대", waiting: "웨이팅",
  restroom: "화장실", accessibility: "접근성", taste: "맛", portion: "음식 양",
  spiciness: "매운맛·향신료", greasiness: "느끼함",
};

export type PublicPlaceFieldVerification = {
  place_id: string;
  field_name: ManagedPlaceField;
  source_type: PlaceFieldSourceType;
  verification_status: PlaceFieldVerificationStatus;
  verified_at: string | null;
  provider: string | null;
  collected_at: string | null;
};

export function isManagedPlaceField(value: unknown): value is ManagedPlaceField {
  return typeof value === "string" && (managedPlaceFields as readonly string[]).includes(value);
}

export function isVerificationStatus(value: unknown): value is PlaceFieldVerificationStatus {
  return typeof value === "string" && (placeVerificationStatuses as readonly string[]).includes(value);
}

export function verificationStatusLabel(status: PlaceFieldVerificationStatus, locale: "ko" | "zh" | "en" | "ja") {
  const labels: Record<PlaceFieldVerificationStatus, Record<typeof locale, string>> = {
    unverified: { ko: "확인 필요", zh: "需要确认", en: "Needs verification", ja: "要確認" },
    auto_imported: { ko: "기본 정보 수집", zh: "已收集基本信息", en: "Basic info collected", ja: "基本情報を収集" },
    online_verified: { ko: "공식 자료 확인", zh: "已核对官方资料", en: "Official source checked", ja: "公式資料を確認" },
    owner_confirmed: { ko: "사업자 제공 정보", zh: "商家提供的信息", en: "Owner-provided information", ja: "事業者提供情報" },
    field_verified: { ko: "직접 방문 확인", zh: "实地到访确认", en: "Checked during a field visit", ja: "現地訪問で確認" },
    needs_recheck: { ko: "최신 정보 확인 필요", zh: "需要重新确认", en: "Update check needed", ja: "再確認が必要" },
  };
  return labels[status][locale];
}

export function fieldVerificationStage(status: PlaceFieldVerificationStatus) {
  if (status === "field_verified") return 3;
  if (status === "online_verified" || status === "owner_confirmed") return 2;
  return 1;
}
