import type { PlaceRecord } from "@/types/database";
import { isPublicPlace } from "@/lib/place-publishing";
import { isValidCoordinates } from "@/lib/location";

type PlaceVisibilityFields = Pick<PlaceRecord, "is_active" | "status" | "latitude" | "longitude">;

export function hasUsableMapCoordinates(place: Pick<PlaceRecord, "latitude" | "longitude">) {
  return isValidCoordinates(place);
}

export function buildAdminPlaceVisibilityNotice(place: PlaceVisibilityFields) {
  if (!isPublicPlace(place)) {
    return "현재 공개 상태가 아니어서 사용자 목록과 지도에는 표시되지 않습니다. 필수 정보를 채운 뒤 상태를 PUBLISHED로 바꿔 저장하세요.";
  }

  if (!hasUsableMapCoordinates(place)) {
    return "공개 상태지만 위도·경도가 정상 범위가 아니어서 지도와 거리 계산에 사용할 수 없습니다. 주소로 좌표 찾기 후 다시 저장하세요.";
  }

  return "사용자 목록과 지도 핀에 표시됩니다.";
}
