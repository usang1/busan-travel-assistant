import { evaluatePlaceQuality } from "@/lib/place-quality";
import {
  archivedPlaceStatus,
  draftPlaceStatus,
  isPublicPlace,
  legacyInactivePlaceStatus,
  reviewPlaceStatus,
} from "@/lib/place-publishing";

type PublicationQualityPlace = Parameters<typeof evaluatePlaceQuality>[0];

export type PlacePublicationState = "draft" | "published" | "verified" | "needs_recheck" | "archived";

export function isPublishablePlace(place: PublicationQualityPlace, _now = new Date()) {
  return isPublicPlace(place);
}

export function isVerifiedPlace(place: PublicationQualityPlace, now = new Date()) {
  const quality = evaluatePlaceQuality(place, now);

  return (
    isPublicPlace(place) &&
    quality.canPublish &&
    !quality.isStale &&
    place.china_info?.verification_status === "verified"
  );
}

export function needsPlaceRecheck(place: PublicationQualityPlace, now = new Date()) {
  const quality = evaluatePlaceQuality(place, now);

  return isPublicPlace(place) && (
    !quality.canPublish ||
    quality.isStale ||
    place.china_info?.verification_status === "needs_review"
  );
}

export function getPlacePublicationState(place: PublicationQualityPlace, now = new Date()): PlacePublicationState {
  if (place.status === archivedPlaceStatus) return "archived";

  if (
    place.status === draftPlaceStatus ||
    place.status === reviewPlaceStatus ||
    place.status === legacyInactivePlaceStatus ||
    !isPublicPlace(place)
  ) {
    return "draft";
  }

  if (needsPlaceRecheck(place, now)) return "needs_recheck";
  if (isVerifiedPlace(place, now)) return "verified";

  return "published";
}

export function filterPublishablePlaces<T extends PublicationQualityPlace>(places: T[], now = new Date()) {
  return places.filter((place) => isPublishablePlace(place, now));
}

export function formatVerifiedBlockMessage(place: PublicationQualityPlace, now = new Date()) {
  const quality = evaluatePlaceQuality(place, now);
  const messages = quality.missingRequired.map((item) => `${item.label}: ${item.reason}`);

  if (quality.isStale) {
    messages.push("마지막 확인일: 180일 이내 확인일이 필요합니다.");
  }

  return messages.join("\n");
}
