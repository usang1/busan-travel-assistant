import type { PlaceStatus, PlaceWorkflowStatus } from "@/types/database";

export const publishedPlaceStatus = "PUBLISHED";
export const draftPlaceStatus = "DRAFT";
export const reviewPlaceStatus = "REVIEW";
export const archivedPlaceStatus = "ARCHIVED";
export const legacyActivePlaceStatus = "ACTIVE";
export const legacyInactivePlaceStatus = "INACTIVE";

export const publicReadablePlaceStatuses = [publishedPlaceStatus, legacyActivePlaceStatus] as const;

export type PlacePublicationFields = {
  is_active?: boolean | null;
  status?: PlaceStatus | string | null;
};

export type PlacePublicStatus = typeof publishedPlaceStatus | typeof legacyActivePlaceStatus;

export function normalizePlaceStatusForWrite(place: PlacePublicationFields): PlaceWorkflowStatus {
  if (place.status === archivedPlaceStatus) return archivedPlaceStatus;
  if (place.status === reviewPlaceStatus) return reviewPlaceStatus;
  if (place.status === draftPlaceStatus || place.status === legacyInactivePlaceStatus) return draftPlaceStatus;
  if (place.status === publishedPlaceStatus || place.status === legacyActivePlaceStatus) return publishedPlaceStatus;
  return place.is_active === true ? publishedPlaceStatus : draftPlaceStatus;
}

export function normalizePlacePublicationForWrite<T extends PlacePublicationFields>(
  place: T,
): T & { is_active: boolean; status: PlaceWorkflowStatus } {
  const status = normalizePlaceStatusForWrite(place);
  return {
    ...place,
    is_active: status === publishedPlaceStatus,
    status,
  };
}

export function isPublicPlace(place: PlacePublicationFields) {
  return place.is_active === true && publicReadablePlaceStatuses.includes(place.status as PlacePublicStatus);
}

export function nextPlacePublicationIsActive(place: PlacePublicationFields) {
  return !isPublicPlace(place);
}

export function nextPlacePublicationStatus(place: PlacePublicationFields): PlaceWorkflowStatus {
  return isPublicPlace(place) ? draftPlaceStatus : publishedPlaceStatus;
}
