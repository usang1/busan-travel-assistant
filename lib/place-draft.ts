import type { NormalizedPlace, NormalizedPlacePhoto, SupportedPlaceProvider } from "@/lib/place-providers/types";

export const WEB_SEARCH_AUTO_ACCEPT_CONFIDENCE = 0.75;
export const WEB_SEARCH_VOLATILE_CONFIDENCE = 0.85;

export const placeDraftFields = [
  "name",
  "category",
  "address",
  "roadAddress",
  "coordinates",
  "phone",
  "openingHours",
  "closedDays",
  "menu",
  "priceRange",
  "parking",
  "description",
  "websiteUrl",
] as const;

export type PlaceDraftField = (typeof placeDraftFields)[number];
export type PlaceFieldKey = PlaceDraftField | "providerPlaceId" | "sourceUrl" | "images" | "priceLevel";
export type PlaceFactSource = "PROVIDER" | "WEB_SEARCH" | "MANUAL";

export type PlaceFactMetadata = {
  source: PlaceFactSource;
  provider?: SupportedPlaceProvider;
  confidence: number;
  needsReview?: boolean;
  sources?: PlaceSourceCitation[];
};

export type PlaceSourceCitation = {
  title?: string;
  url: string;
  type?: "OFFICIAL" | "MAP" | "PLATFORM" | "BLOG" | "OTHER";
};

export type PlaceMenuItem = {
  name: string;
  price?: number;
};

export type PlaceDraft = {
  provider: SupportedPlaceProvider;
  providerPlaceId?: string;
  sourceUrl: string;
  finalResolvedUrl?: string;
  lookupQuery?: string;
  name?: string;
  address?: string;
  roadAddress?: string;
  latitude?: number;
  longitude?: number;
  coordinates?: { latitude: number; longitude: number };
  category?: string;
  phone?: string;
  openingHours?: string | string[];
  closedDays?: string | string[];
  menu?: PlaceMenuItem[];
  priceLevel?: number;
  priceRange?: { min?: number; max?: number; currency?: string };
  parking?: boolean;
  description?: string;
  websiteUrl?: string;
  images: NormalizedPlacePhoto[];
  fieldSources: Partial<Record<PlaceFieldKey, PlaceFactMetadata>>;
};

export type WebSearchFact<T> = {
  value: T | null;
  confidence: number;
  sourceUrls: string[];
};

export type WebSearchEnrichmentData = Partial<Record<PlaceDraftField, WebSearchFact<unknown>>> & {
  sources: PlaceSourceCitation[];
};

export type PlaceDraftMergeResult = {
  draft: PlaceDraft;
  normalizedPlace: NormalizedPlace;
  acceptedFields: PlaceDraftField[];
  needsReviewFields: PlaceDraftField[];
};

export function createPlaceDraft(place: NormalizedPlace): PlaceDraft {
  const openingHours = place.openingHours ?? place.currentOpeningHours;
  const coordinates = normalizeDraftCoordinates(place.latitude, place.longitude);
  const priceRange = place.priceRange ?? (
    place.priceMin !== undefined || place.priceMax !== undefined
      ? { min: place.priceMin, max: place.priceMax, currency: "KRW" }
        : undefined
  );
  const draft: PlaceDraft = {
    provider: place.provider,
    providerPlaceId: place.providerPlaceId,
    sourceUrl: place.sourceUrl,
    finalResolvedUrl: place.finalResolvedUrl,
    lookupQuery: place.lookupQuery,
    name: place.name,
    address: place.addressKo ?? place.formattedAddress,
    roadAddress: place.roadAddressKo,
    latitude: place.latitude,
    longitude: place.longitude,
    coordinates,
    category: place.category,
    phone: place.phone,
    openingHours,
    closedDays: place.closedDays,
    menu: place.menu,
    priceLevel: place.priceLevel,
    priceRange,
    parking: place.amenities?.parking,
    description: place.description,
    websiteUrl: place.website,
    images: place.photos ?? [],
    fieldSources: { ...(place.fieldSources ?? {}) },
  };

  const providerFields: Partial<Record<PlaceFieldKey, unknown>> = {
    providerPlaceId: place.providerPlaceId,
    sourceUrl: place.sourceUrl,
    images: draft.images.length ? draft.images : undefined,
    priceLevel: place.priceLevel,
  };
  for (const [field, value] of Object.entries(providerFields)) {
    if (hasDraftValue(value)) {
      draft.fieldSources[field as PlaceFieldKey] ??= {
        source: "PROVIDER",
        provider: place.provider,
        confidence: 1,
      };
    }
  }

  for (const field of placeDraftFields) {
    if (hasDraftValue(draft[field])) {
      draft.fieldSources[field] ??= {
        source: "PROVIDER",
        provider: place.provider,
        confidence: 1,
      };
    }
  }

  return draft;
}

export function getMissingPlaceFields(placeDraft: PlaceDraft): PlaceDraftField[] {
  return placeDraftFields.filter((field) => !hasDraftValue(placeDraft[field]));
}

export function mergePlaceData(
  providerData: NormalizedPlace,
  webSearchData?: WebSearchEnrichmentData | null,
): PlaceDraftMergeResult {
  const draft = createPlaceDraft(providerData);
  const acceptedFields: PlaceDraftField[] = [];
  const needsReviewFields: PlaceDraftField[] = [];

  for (const field of getMissingPlaceFields(draft)) {
    const candidate = webSearchData?.[field];
    if (!candidate || candidate.value === null || candidate.value === undefined) continue;

    const confidence = normalizeConfidence(candidate.confidence);
    const threshold = isVolatileField(field)
      ? WEB_SEARCH_VOLATILE_CONFIDENCE
      : WEB_SEARCH_AUTO_ACCEPT_CONFIDENCE;
    const sources = normalizeSourceUrls(candidate.sourceUrls, webSearchData.sources);

    if (confidence < threshold || sources.length === 0) {
      needsReviewFields.push(field);
      continue;
    }

    const value = normalizeFieldValue(field, candidate.value);
    if (value === undefined) {
      needsReviewFields.push(field);
      continue;
    }

    draft[field] = value as never;
    draft.fieldSources[field] = {
      source: "WEB_SEARCH",
      confidence,
      needsReview: isVolatileField(field),
      sources,
    };
    acceptedFields.push(field);
  }

  return {
    draft,
    normalizedPlace: applyDraftToNormalizedPlace(providerData, draft),
    acceptedFields,
    needsReviewFields,
  };
}

export function formatPlaceFactSource(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const metadata = value as Partial<PlaceFactMetadata>;
  if (metadata.source === "PROVIDER") {
    return `출처: ${(metadata.provider ?? "provider").toUpperCase()}`;
  }
  if (metadata.source === "WEB_SEARCH") {
    const confidence = typeof metadata.confidence === "number" ? ` · 신뢰도 ${Math.round(metadata.confidence * 100)}%` : "";
    return `출처: Web Search${confidence}${metadata.needsReview ? " · 확인 필요" : ""}`;
  }
  return "출처: 관리자 입력";
}

function applyDraftToNormalizedPlace(providerData: NormalizedPlace, draft: PlaceDraft): NormalizedPlace {
  const next: NormalizedPlace = {
    ...providerData,
    name: draft.name,
    category: draft.category,
    addressKo: draft.address,
    roadAddressKo: draft.roadAddress,
    formattedAddress: draft.roadAddress ?? draft.address ?? providerData.formattedAddress,
    latitude: draft.coordinates?.latitude,
    longitude: draft.coordinates?.longitude,
    openingHours: draft.openingHours,
    closedDays: draft.closedDays,
    menu: draft.menu,
    description: draft.description,
    website: draft.websiteUrl,
    priceRange: draft.priceRange ?? providerData.priceRange,
    priceMin: draft.priceRange?.min ?? providerData.priceMin,
    priceMax: draft.priceRange?.max ?? providerData.priceMax,
    amenities: draft.parking === undefined
      ? providerData.amenities
      : { ...(providerData.amenities ?? {}), parking: draft.parking },
    fieldSources: draft.fieldSources,
  };

  return next;
}

function hasDraftValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeFieldValue(field: PlaceDraftField, value: unknown) {
  if (field === "coordinates") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const latitude = typeof record.latitude === "number" ? record.latitude : Number.NaN;
    const longitude = typeof record.longitude === "number" ? record.longitude : Number.NaN;
    return normalizeDraftCoordinates(latitude, longitude);
  }
  if (field === "parking") return typeof value === "boolean" ? value : undefined;
  if (field === "menu") {
    if (!Array.isArray(value)) return undefined;
    const menu = value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const price = typeof record.price === "number" && Number.isFinite(record.price) ? Math.max(0, Math.round(record.price)) : undefined;
      return name ? [{ name, ...(price === undefined ? {} : { price }) }] : [];
    }).slice(0, 20);
    return menu.length ? menu : undefined;
  }
  if (field === "priceRange") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const min = normalizeMoney(record.min);
    const max = normalizeMoney(record.max);
    if (min === undefined && max === undefined) return undefined;
    return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), currency: "KRW" };
  }
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 2000);
  return undefined;
}

function normalizeMoney(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function normalizeConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function isVolatileField(field: PlaceDraftField) {
  return field === "coordinates" || field === "openingHours" || field === "closedDays" || field === "menu" || field === "priceRange" || field === "parking";
}

function normalizeDraftCoordinates(latitude: unknown, longitude: unknown) {
  if (
    typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  ) {
    return { latitude, longitude };
  }

  return undefined;
}

function normalizeSourceUrls(urls: unknown, fallback: PlaceSourceCitation[]) {
  const candidates = [
    ...(Array.isArray(urls) ? urls : []),
    ...fallback.map((source) => source.url),
  ];
  return Array.from(new Set(candidates.filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)).slice(0, 5)))
    .map((url) => ({ url }));
}
