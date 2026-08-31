import { asRecord, finiteNumber, normalizeCoordinates, text } from "@/lib/place-providers/normalize";
import type { NormalizedPlace, PlaceProvider, PlaceProviderLookupContext } from "@/lib/place-providers/types";

const placeFields = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours.weekdayDescriptions",
  "currentOpeningHours.weekdayDescriptions",
  "currentOpeningHours.openNow",
  "rating",
  "userRatingCount",
  "priceLevel",
  "priceRange",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "googleMapsUri",
  "photos",
  "parkingOptions",
  "reservable",
  "takeout",
  "restroom",
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

    if (!raw) return null;

    const normalized = normalizeGooglePlace(raw);
    if (!normalized) return null;

    const photos = await resolveGooglePhotos(raw, apiKey, context.fetcher);
    return {
      ...normalized,
      imageUrl: photos[0]?.url,
      primaryImageUrl: photos[0]?.url,
      photos: photos.length ? photos : undefined,
      fetchedAt: new Date().toISOString(),
    };
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
  const currentOpeningHours = asRecord(place.currentOpeningHours);
  const priceRange = asRecord(place.priceRange);
  const weekdayDescriptions = Array.isArray(openingHours?.weekdayDescriptions)
    ? openingHours.weekdayDescriptions.filter((item): item is string => typeof item === "string")
    : undefined;
  const currentWeekdayDescriptions = Array.isArray(currentOpeningHours?.weekdayDescriptions)
    ? currentOpeningHours.weekdayDescriptions.filter((item): item is string => typeof item === "string")
    : undefined;
  const coordinates = normalizeCoordinates(location?.latitude, location?.longitude);
  const priceMin = normalizeKrwMoney(priceRange?.startPrice);
  const priceMax = normalizeKrwMoney(priceRange?.endPrice);
  const types = stringArray(place.types);

  return {
    providerPlaceId: text(place.id),
    name: text(displayName?.text),
    category: text(typeDisplayName?.text) ?? text(place.primaryType) ?? types?.[0],
    types,
    addressKo: text(place.formattedAddress),
    formattedAddress: text(place.formattedAddress) ?? text(place.shortFormattedAddress),
    ...coordinates,
    phone: text(place.nationalPhoneNumber) ?? text(place.internationalPhoneNumber),
    website: text(place.websiteUri),
    providerUri: text(place.googleMapsUri),
    openingHours: weekdayDescriptions?.length ? weekdayDescriptions : undefined,
    currentOpeningHours: currentWeekdayDescriptions?.length ? currentWeekdayDescriptions : undefined,
    rating: finiteNumber(place.rating),
    reviewCount: finiteNumber(place.userRatingCount),
    priceLevel: normalizeGooglePriceLevel(place.priceLevel),
    priceMin,
    priceMax,
    priceRange: priceMin !== undefined || priceMax !== undefined
      ? { min: priceMin, max: priceMax, currency: "KRW" }
      : undefined,
    amenities: normalizeGoogleAmenities(place),
    raw: sanitizeGoogleRaw(place),
  };
}

async function resolveGooglePhotos(value: unknown, apiKey: string, fetcher: typeof fetch) {
  const place = asRecord(value);
  const rawPhotos = Array.isArray(place?.photos) ? place.photos.slice(0, 3) : [];
  const fetchedAt = new Date().toISOString();

  const candidates = await Promise.all(rawPhotos.map(async (item) => {
    const photo = asRecord(item);
    const reference = text(photo?.name);
    if (!reference?.startsWith("places/")) return null;

    try {
      const endpoint = new URL(`https://places.googleapis.com/v1/${reference}/media`);
      endpoint.searchParams.set("maxWidthPx", "1200");
      endpoint.searchParams.set("maxHeightPx", "1200");
      endpoint.searchParams.set("skipHttpRedirect", "true");
      endpoint.searchParams.set("key", apiKey);
      const response = await fetcher(endpoint, { cache: "no-store" });
      if (!response.ok) return null;

      const media = asRecord(await response.json());
      const url = text(media?.photoUri);
      if (!url) return null;

      return {
        reference,
        url,
        attribution: formatPhotoAttributions(photo?.authorAttributions),
        width: finiteNumber(photo?.widthPx),
        height: finiteNumber(photo?.heightPx),
        persistence: "preview_only" as const,
        fetchedAt,
      };
    } catch {
      return null;
    }
  }));

  return candidates.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));
}

function formatPhotoAttributions(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const labels = value.map((item) => {
    const attribution = asRecord(item);
    const name = text(attribution?.displayName);
    const uri = text(attribution?.uri);
    return name && uri ? `${name} (${uri})` : name ?? uri;
  }).filter((item): item is string => Boolean(item));
  return labels.length ? labels.join(", ") : undefined;
}

function sanitizeGoogleRaw(place: Record<string, unknown>) {
  const { photos, ...facts } = place;
  return {
    ...facts,
    photoCount: Array.isArray(photos) ? photos.length : 0,
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

function normalizeKrwMoney(value: unknown) {
  const money = asRecord(value);
  if (!money || money.currencyCode !== "KRW") return undefined;
  const units = finiteNumber(money.units);
  const nanos = finiteNumber(money.nanos) ?? 0;
  return units === undefined ? undefined : Math.max(0, Math.round(units + nanos / 1_000_000_000));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function normalizeGoogleAmenities(place: Record<string, unknown>) {
  const parkingOptions = asRecord(place.parkingOptions);
  const parking = parkingOptions
    ? Object.values(parkingOptions).some((value) => value === true)
    : undefined;

  const amenities = {
    parking,
    reservable: typeof place.reservable === "boolean" ? place.reservable : undefined,
    takeout: typeof place.takeout === "boolean" ? place.takeout : undefined,
    restroom: typeof place.restroom === "boolean" ? place.restroom : undefined,
  };
  return Object.values(amenities).some((value) => value !== undefined) ? amenities : undefined;
}

function providerError(message: string, providerStatus: number) {
  return Object.assign(new Error(message), { status: 502, expose: true, providerStatus });
}
