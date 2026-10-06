import { normalizeCoordinates } from "@/lib/place-providers/normalize";
import { normalizeMenuPrice, normalizePlacePriceAmount } from "@/lib/place-data-integrity";
import { evaluatePlaceQuality } from "@/lib/place-quality";
import { formatVerifiedBlockMessage } from "@/lib/place-publication-quality";
import { getPlaceScopeIssueLabels, isCityScopedPlace } from "@/lib/place-scope";
import { placeCategories, type PlacePayload } from "@/types/database";

export function validatePlacePayloadForSave(payload: PlacePayload) {
  if (!payload.name_ko.trim() && !payload.name_zh.trim()) {
    throw validationError("장소명은 필수입니다.");
  }

  if (!placeCategories.includes(payload.category)) {
    throw validationError("카테고리를 선택해 주세요.");
  }

  const hasPartialCoordinates = payload.latitude !== null || payload.longitude !== null;
  if (hasPartialCoordinates && !normalizeCoordinates(payload.latitude, payload.longitude)) {
    throw validationError("위도·경도 값이 정상 범위를 벗어났습니다.");
  }

  if (payload.price_level !== null && payload.price_level !== undefined && (!Number.isInteger(payload.price_level) || payload.price_level < 0 || payload.price_level > 4)) {
    throw validationError("가격대는 0부터 4 사이의 정수여야 합니다.");
  }

  if (payload.price_min !== null && payload.price_max !== null && payload.price_min > payload.price_max) {
    throw validationError("최대 가격은 최소 가격보다 작을 수 없습니다.");
  }

  for (const [label, value] of [["최소 가격", payload.price_min], ["최대 가격", payload.price_max]] as const) {
    if (value !== null && normalizePlacePriceAmount(value, payload.category) === null) {
      throw validationError(`${label}은 무료 0원 또는 정상 원화 정수로 입력해 주세요. 음식·음료의 1~999원 값은 저장할 수 없습니다.`);
    }
  }

  const invalidMenu = (payload.menu_items ?? []).find((item) => item.price !== null && normalizeMenuPrice(item.price) === null);
  if (invalidMenu) {
    throw validationError(`메뉴 가격은 미확인(null), 무료(0), 또는 1,000원 이상의 정수만 허용됩니다: ${invalidMenu.name_ko || invalidMenu.name_zh || "메뉴"}`);
  }

  const isPublic = payload.is_active && (payload.status === "PUBLISHED" || payload.status === "ACTIVE");
  if (isPublic && (!payload.city_code || !payload.district_code)) {
    throw validationError("공개 장소는 도시와 구·군을 확인해야 합니다.");
  }

  if (isPublic && payload.city_code === "busan") {
    const scopeIssues = getPlaceScopeIssueLabels(payload);
    if (scopeIssues.length > 0) {
      throw validationError(`부산 공개 범위를 확인해 주세요: ${scopeIssues.join(", ")}`);
    }
  }

  if (isPublic && payload.city_code && payload.city_code !== "busan" && !isCityScopedPlace(payload, payload.city_code)) {
    throw validationError("공개 장소의 선택 도시, 주소, 구역, 좌표가 서로 일치하는지 확인해 주세요.");
  }

  if (payload.china_info?.verification_basis === "official_source" && !payload.source?.source_url && !payload.website) {
    throw validationError("공식 출처 확인은 출처 URL 또는 공식 웹사이트가 필요합니다.");
  }

  if (payload.china_info?.verification_basis === "traveler" && (payload.china_info.traveler_confirmation_count ?? 0) < 1) {
    throw validationError("여행자 확인 근거에는 확인한 여행자 수가 필요합니다.");
  }

  if (payload.china_info?.has_information_conflict && payload.china_info.verification_status === "verified") {
    throw validationError("정보 충돌이 있는 장소는 검증 완료로 저장할 수 없습니다.");
  }

  if (payload.china_info?.verification_status === "verified") {
    const quality = evaluatePlaceQuality(payload);

    if (!quality.canPublish || quality.isStale) {
      throw validationError(`검증 완료로 저장할 수 없습니다. 누락되었거나 오래된 검수 정보를 확인해 주세요.\n${formatVerifiedBlockMessage(payload)}`);
    }
  }
}

function validationError(message: string) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}
