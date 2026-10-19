import type { PlaceDraftField } from "@/lib/place-draft";
import type { NormalizedPlace } from "@/lib/place-providers/types";

export const placeAutofillFields = [
  "name",
  "address",
  "coordinates",
  "phone",
  "openingHours",
  "closedDays",
  "breakTime",
  "lastOrder",
  "menu",
  "menuPrice",
  "menuDescription",
  "image",
  "category",
  "website",
  "amenities",
  "payment",
  "foreignAccess",
] as const;

export type PlaceAutofillField = (typeof placeAutofillFields)[number];
export type PlaceAutofillFieldStatus = "auto_filled" | "no_data" | "lookup_failed" | "review_required" | "manual_preserved";

export type PlaceAutofillFieldResult = {
  field: PlaceAutofillField;
  label: string;
  status: PlaceAutofillFieldStatus;
  source: string;
  reasonCode?: string;
  retryable: boolean;
};

export type PlaceAutofillDiagnostics = {
  runId: string;
  provider: string;
  startedAt: string;
  durationMs: number;
  status: "success" | "partial" | "failed";
  errorCode?: string;
  retryOf?: string;
  fieldResults: PlaceAutofillFieldResult[];
};

const labels: Record<PlaceAutofillField, string> = {
  name: "가게명",
  address: "주소",
  coordinates: "위도·경도",
  phone: "전화번호",
  openingHours: "영업시간",
  closedDays: "정기휴무",
  breakTime: "브레이크타임",
  lastOrder: "라스트오더",
  menu: "대표 메뉴",
  menuPrice: "메뉴 가격",
  menuDescription: "메뉴 설명",
  image: "대표 이미지",
  category: "카테고리",
  website: "공식 홈페이지",
  amenities: "편의시설",
  payment: "결제 정보",
  foreignAccess: "외국인 이용 정보",
};

const fieldToDraftFields: Partial<Record<PlaceAutofillField, PlaceDraftField[]>> = {
  name: ["name"],
  address: ["address", "roadAddress"],
  coordinates: ["coordinates"],
  phone: ["phone"],
  openingHours: ["openingHours"],
  closedDays: ["closedDays"],
  breakTime: ["openingHours"],
  lastOrder: ["openingHours"],
  menu: ["menu"],
  menuPrice: ["menu", "priceRange"],
  menuDescription: ["menu"],
  category: ["category"],
  website: ["websiteUrl"],
  amenities: ["parking"],
};

export function toDraftRetryFields(fields: PlaceAutofillField[] | undefined) {
  if (!fields?.length) return [];
  return Array.from(new Set(fields.flatMap((field) => fieldToDraftFields[field] ?? [])));
}

export function sanitizeAutofillFields(value: unknown): PlaceAutofillField[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(placeAutofillFields);
  return Array.from(new Set(value.filter((field): field is PlaceAutofillField => typeof field === "string" && allowed.has(field))));
}

export function buildAutofillFieldResults(input: {
  place: NormalizedPlace;
  provider: string;
  lookupFailed?: boolean;
  webSearchFailed?: boolean;
  webSearchAttempted?: boolean;
  needsReviewFields?: PlaceDraftField[];
  requestedFields?: PlaceAutofillField[];
}): PlaceAutofillFieldResult[] {
  const requested = input.requestedFields?.length ? new Set(input.requestedFields) : null;
  const needsReview = new Set(input.needsReviewFields ?? []);
  const values = fieldValues(input.place);

  return placeAutofillFields.filter((field) => !requested || requested.has(field)).map((field) => {
    const value = values[field];
    const draftFields = fieldToDraftFields[field] ?? [];
    const review = draftFields.some((candidate) => needsReview.has(candidate)) || hasReviewMetadata(input.place, draftFields);
    if (hasValue(value)) {
      return result(field, review ? "review_required" : "auto_filled", sourceForField(input.place, draftFields, input.provider), review ? "SOURCE_REVIEW_REQUIRED" : undefined, false);
    }
    const supportedBySearch = draftFields.length > 0;
    const lookupFailed = input.lookupFailed || (input.webSearchAttempted && input.webSearchFailed && supportedBySearch);
    return result(
      field,
      lookupFailed ? "lookup_failed" : "no_data",
      input.provider,
      lookupFailed ? "SOURCE_LOOKUP_FAILED" : supportedBySearch ? "SOURCE_RETURNED_NO_DATA" : "SOURCE_NOT_SUPPORTED",
      supportedBySearch,
    );
  });
}

export function buildFailedAutofillFieldResults(provider: string, requestedFields?: PlaceAutofillField[]) {
  const requested = requestedFields?.length ? new Set(requestedFields) : null;
  return placeAutofillFields.filter((field) => !requested || requested.has(field)).map((field) => result(
    field,
    "lookup_failed",
    provider,
    "AUTOFILL_REQUEST_FAILED",
    (fieldToDraftFields[field]?.length ?? 0) > 0,
  ));
}

function fieldValues(place: NormalizedPlace): Record<PlaceAutofillField, unknown> {
  const menu = place.menu ?? [];
  const hours = [place.openingHours, place.currentOpeningHours].flatMap((value) => Array.isArray(value) ? value : value ? [value] : []);
  return {
    name: place.name,
    address: place.roadAddressKo ?? place.addressKo ?? place.formattedAddress,
    coordinates: place.latitude !== undefined && place.longitude !== undefined ? [place.latitude, place.longitude] : null,
    phone: place.phone,
    openingHours: place.openingHours ?? place.currentOpeningHours,
    closedDays: place.closedDays,
    breakTime: hours.find((value) => /브레이크|break\s*time/i.test(value)),
    lastOrder: hours.find((value) => /라스트\s*오더|last\s*order/i.test(value)),
    menu,
    menuPrice: menu.some((item) => item.price !== undefined) ? true : place.priceRange,
    menuDescription: menu.some((item) => Boolean(item.description?.trim()) || (item.composition?.length ?? 0) > 0 || (item.reviewHighlights?.length ?? 0) > 0),
    image: place.photos?.find((photo) => photo.url)?.url ?? place.primaryImageUrl ?? place.imageUrl,
    category: place.category,
    website: place.website,
    amenities: place.amenities && Object.values(place.amenities).some((value) => value !== undefined) ? place.amenities : null,
    payment: undefined,
    foreignAccess: undefined,
  };
}

function sourceForField(place: NormalizedPlace, draftFields: PlaceDraftField[], fallback: string) {
  for (const field of draftFields) {
    const source = place.fieldSources?.[field]?.source;
    if (source) return source;
  }
  return fallback;
}

function hasReviewMetadata(place: NormalizedPlace, draftFields: PlaceDraftField[]) {
  return draftFields.some((field) => place.fieldSources?.[field]?.needsReview === true);
}

function result(field: PlaceAutofillField, status: PlaceAutofillFieldStatus, source: string, reasonCode: string | undefined, retryable: boolean): PlaceAutofillFieldResult {
  return { field, label: labels[field], status, source, ...(reasonCode ? { reasonCode } : {}), retryable };
}

function hasValue(value: unknown) {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
