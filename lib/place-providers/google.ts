import { asRecord, finiteNumber, normalizeCoordinates, text } from "@/lib/place-providers/normalize";
import type { NormalizedPlace, PlaceProvider, PlaceProviderLookupContext } from "@/lib/place-providers/types";

const placeFields = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "nationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours.weekdayDescriptions",
  "rating",
  "userRatingCount",
  "priceLevel",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "googleMapsUri",
  "photos",
].join(",");

export const googleMapsProvider: PlaceProvider = {
  id: "google",
  async lookup(context) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) return null;

    const parsed = [...context.parsedUrls].reverse().find((item) => item.provider === "google");
    if (!parsed) return null;

    const placeId = normalizeGooglePlaceId(parsed.placeId);
    let raw: unknown = null;

    if (placeId) {
      raw = await fetchGooglePlaceDetails(placeId, apiKey, context.fetcher);
    } else if (parsed.title) {
      raw = await searchGooglePlace(parsed.title, parsed.latitude, parsed.longitude, apiKey, context.fetcher);
    }

    return raw ? normalizeGooglePlace(raw) : null;
  },
};

async function fetchGooglePlaceDetails(placeId: string, apiKey: string, fetcher: typeof fetch) {
  const response = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ko&regionCode=KR`, {
    headers: googleHeaders(apiKey, placeFields),
    cache: "no-store",
  });

  if (!response.ok) {
    throw providerError("Google Places 상세 조회에 실패했습니다.", response.status);
  }

  return response.json();
}

async function searchGooglePlace(
  query: string,
  latitude: number | undefined,
  longitude: number | undefined,
  apiKey: string,
  fetcher: typeof fetch,
) {
  const coordinates = normalizeCoordinates(latitude, longitude);
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      ...googleHeaders(apiKey, placeFields.split(",").map((field) => `places.${field}`).join(",")),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ko",
      regionCode: "KR",
      pageSize: 1,
      ...(coordinates
        ? { locationBias: { circle: { center: coordinates, radius: 1000 } } }
        : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw providerError("Google Places 검색에 실패했습니다.", response.status);
  }

  const body = asRecord(await response.json());
  return Array.isArray(body?.places) ? body.places[0] : null;
}

function normalizeGooglePlace(value: unknown): Partial<NormalizedPlace> | null {
  const place = asRecord(value);
  if (!place) return null;

  const displayName = asRecord(place.displayName);
  const typeDisplayName = asRecord(place.primaryTypeDisplayName);
  const location = asRecord(place.location);
  const openingHours = asRecord(place.regularOpeningHours);
  const weekdayDescriptions = Array.isArray(openingHours?.weekdayDescriptions)
    ? openingHours.weekdayDescriptions.filter((item): item is string => typeof item === "string")
    : undefined;
  const coordinates = normalizeCoordinates(location?.latitude, location?.longitude);

  return {
    providerPlaceId: text(place.id),
    name: text(displayName?.text),
    category: text(typeDisplayName?.text) ?? text(place.primaryType) ?? stringArray(place.types)?.[0],
    addressKo: text(place.formattedAddress),
    formattedAddress: text(place.formattedAddress) ?? text(place.shortFormattedAddress),
    ...coordinates,
    phone: text(place.nationalPhoneNumber),
    website: text(place.websiteUri),
    openingHours: weekdayDescriptions?.length ? weekdayDescriptions : undefined,
    rating: finiteNumber(place.rating),
    reviewCount: finiteNumber(place.userRatingCount),
    priceLevel: normalizeGooglePriceLevel(place.priceLevel),
    raw: place,
  };
}

function googleHeaders(apiKey: string, fieldMask: string) {
  return {
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask": fieldMask,
  };
}

function normalizeGooglePlaceId(value?: string) {
  return value?.startsWith("ChI") ? value : undefined;
}

function normalizeGooglePriceLevel(value: unknown) {
  const levels: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return typeof value === "string" ? levels[value] : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function providerError(message: string, providerStatus: number) {
  return Object.assign(new Error(message), { status: 502, expose: true, providerStatus });
}
