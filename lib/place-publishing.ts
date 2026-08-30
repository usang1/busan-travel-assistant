export const activePlaceStatus = "ACTIVE";
export const draftPlaceStatus = "DRAFT";
export const archivedPlaceStatus = "ARCHIVED";

export type PlacePublicationFields = {
  is_active?: boolean | null;
  status?: string | null;
};

export type PlacePublicStatus = typeof activePlaceStatus | typeof draftPlaceStatus;

export function normalizePlacePublicationForWrite<T extends PlacePublicationFields>(
  place: T,
): T & { is_active: boolean; status: PlacePublicStatus } {
  const isActive = place.is_active ?? true;

  return {
    ...place,
    is_active: isActive,
    status: isActive ? activePlaceStatus : draftPlaceStatus,
  };
}

export function isPublicPlace(place: PlacePublicationFields) {
  return place.is_active === true && place.status === activePlaceStatus;
}
