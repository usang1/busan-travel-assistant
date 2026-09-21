import { getBusanDistrictKey, isBusanDistrictKey } from "@/lib/busan-districts";
import { getPlaceRegion, inferPlaceCity, type PlaceCity } from "@/lib/city-regions";

export const busanCoordinateBounds = {
  minLatitude: 34.95,
  maxLatitude: 35.45,
  minLongitude: 128.65,
  maxLongitude: 129.4,
} as const;

export type PlaceScopeIssueCode =
  | "city_missing"
  | "city_conflict"
  | "not_busan"
  | "district_missing"
  | "district_conflict"
  | "coordinates_missing"
  | "coordinates_outside_busan";

export type PlaceScopeInput = {
  city_code?: PlaceCity | null;
  district_code?: string | null;
  address?: string | null;
  address_ko?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tags?: Array<{ slug: string }> | null;
};

const issueLabels: Record<PlaceScopeIssueCode, string> = {
  city_missing: "도시 확인 필요",
  city_conflict: "도시 값과 주소 불일치",
  not_busan: "부산 외 도시",
  district_missing: "부산 구·군 확인 필요",
  district_conflict: "구·군 값과 주소 불일치",
  coordinates_missing: "좌표 확인 필요",
  coordinates_outside_busan: "좌표가 부산 범위 밖",
};

export function getPlaceScopeIssues(place: PlaceScopeInput): PlaceScopeIssueCode[] {
  const address = place.address_ko || place.address || "";
  const addressCity = inferPlaceCity(address);
  const taggedRegion = getPlaceRegion(place);
  const city = place.city_code ?? taggedRegion.city;
  const district = place.district_code ?? taggedRegion.region_key;
  const addressDistrict = getBusanDistrictKey({ address_ko: address });
  const issues: PlaceScopeIssueCode[] = [];

  if (!city) issues.push("city_missing");
  if (city && addressCity && city !== addressCity) issues.push("city_conflict");
  if (city && city !== "busan") issues.push("not_busan");
  if (!district || !isBusanDistrictKey(district)) issues.push("district_missing");
  if (district && addressDistrict && district !== addressDistrict) issues.push("district_conflict");

  if (!hasFiniteCoordinates(place)) {
    issues.push("coordinates_missing");
  } else if (!isWithinBusanCoordinates(place.latitude as number, place.longitude as number)) {
    issues.push("coordinates_outside_busan");
  }

  return Array.from(new Set(issues));
}

export function isBusanScopedPlace(place: PlaceScopeInput) {
  return getPlaceScopeIssues(place).length === 0;
}

export function filterBusanScopedPlaces<T extends PlaceScopeInput>(places: T[]) {
  return places.filter(isBusanScopedPlace);
}

export function getPlaceScopeIssueLabels(place: PlaceScopeInput) {
  return getPlaceScopeIssues(place).map((issue) => issueLabels[issue]);
}

export function isWithinBusanCoordinates(latitude: number, longitude: number) {
  return latitude >= busanCoordinateBounds.minLatitude
    && latitude <= busanCoordinateBounds.maxLatitude
    && longitude >= busanCoordinateBounds.minLongitude
    && longitude <= busanCoordinateBounds.maxLongitude;
}

function hasFiniteCoordinates(place: PlaceScopeInput) {
  return typeof place.latitude === "number"
    && Number.isFinite(place.latitude)
    && typeof place.longitude === "number"
    && Number.isFinite(place.longitude);
}
