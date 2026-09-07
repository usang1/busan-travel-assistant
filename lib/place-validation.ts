import { normalizeCoordinates } from "@/lib/place-providers/normalize";
import { evaluatePlaceQuality, formatQualityBlockMessage } from "@/lib/place-quality";
import { isPublicPlace } from "@/lib/place-publishing";
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

  if (isPublicPlace(payload)) {
    const quality = evaluatePlaceQuality(payload);

    if (!quality.canPublish) {
      throw validationError(`공개할 수 없습니다. 누락된 필수 정보를 확인해 주세요.\n${formatQualityBlockMessage(quality)}`);
    }
  }
}

function validationError(message: string) {
  return Object.assign(new Error(message), { status: 400, expose: true });
}
