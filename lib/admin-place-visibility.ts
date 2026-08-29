import type { PlaceRecord } from "@/types/database";

type PlaceVisibilityFields = Pick<PlaceRecord, "is_active" | "latitude" | "longitude">;

export function hasUsableMapCoordinates(place: Pick<PlaceRecord, "latitude" | "longitude">) {
  return typeof place.latitude === "number" && Number.isFinite(place.latitude) && typeof place.longitude === "number" && Number.isFinite(place.longitude);
}

export function buildAdminPlaceVisibilityNotice(place: PlaceVisibilityFields) {
  if (!place.is_active) {
    return "현재 비공개 상태라 사용자 목록과 지도에는 표시되지 않습니다. 공개하려면 활성/즉시 공개를 켠 뒤 다시 저장하세요.";
  }

  if (!hasUsableMapCoordinates(place)) {
    return "사용자 목록에는 표시될 수 있지만 위도/경도가 없어 지도 핀은 표시되지 않습니다. 주소로 좌표 찾기 후 다시 저장하세요.";
  }

  return "사용자 목록과 지도 핀에 표시됩니다.";
}
