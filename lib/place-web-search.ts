import OpenAI from "openai";
import { toPublicOpenAiError } from "@/lib/openai-errors";
import type {
  PlaceDraft,
  PlaceDraftField,
  PlaceSourceCitation,
  WebSearchFact,
  WebSearchEnrichmentData,
} from "@/lib/place-draft";
import { placeDraftFields, WEB_SEARCH_VOLATILE_CONFIDENCE } from "@/lib/place-draft";

const defaultModel = "gpt-5.6-luna";
const requestTimeoutMs = 25_000;
const webSearchCacheTtlMs = 10 * 60 * 1000;
const searchCache = new Map<string, { expiresAt: number; value: Promise<PlaceWebSearchResult> }>();

export type PlaceWebSearchResult = {
  data: WebSearchEnrichmentData;
  identity: PlaceWebSearchIdentity;
  searchedFields: PlaceDraftField[];
  needsReviewFields: PlaceDraftField[];
  sources: PlaceSourceCitation[];
  model: string;
  searchedAt: string;
};

export type PlaceWebSearchIdentity = {
  matched: boolean;
  reason: string;
  confidence: number;
  name?: string;
  address?: string;
  category?: string;
  providerPlaceId?: string;
  sourceUrls: string[];
};

export type PlaceWebSearchHints = {
  name?: string;
  address?: string;
  category?: string;
};

export async function searchMissingPlaceDataCached(place: PlaceDraft, missingFields: PlaceDraftField[], hints: PlaceWebSearchHints = {}) {
  const key = JSON.stringify({
    provider: place.provider,
    placeId: place.providerPlaceId,
    sourceUrl: place.sourceUrl,
    lookupQuery: place.lookupQuery,
    name: place.name,
    address: place.roadAddress ?? place.address,
    category: place.category,
    hints,
    missingFields,
  });
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = searchMissingPlaceData(place, missingFields, hints);
  searchCache.set(key, { expiresAt: Date.now() + webSearchCacheTtlMs, value });
  try {
    return await value;
  } catch (error) {
    searchCache.delete(key);
    throw error;
  }
}

export async function searchMissingPlaceData(place: PlaceDraft, missingFields: PlaceDraftField[], hints: PlaceWebSearchHints = {}): Promise<PlaceWebSearchResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  if (!missingFields.length) {
    return {
      data: { sources: [] },
      identity: { matched: true, reason: "검색할 누락 필드가 없습니다.", confidence: 1, sourceUrls: [] },
      searchedFields: [],
      needsReviewFields: [],
      sources: [],
      model: process.env.OPENAI_PLACE_MODEL || defaultModel,
      searchedAt: new Date().toISOString(),
    };
  }

  const model = process.env.OPENAI_PLACE_MODEL || defaultModel;
  const client = new OpenAI({ apiKey, timeout: requestTimeoutMs, maxRetries: 0 });
  try {
    const response = await client.responses.create({
      model,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      input: [
        {
          role: "system",
          content: [
            "You research only the missing factual fields for a specific place in South Korea.",
            "Provider data is authoritative. Never change or repeat provider values as web facts.",
            "The provider lookup query is not the place name. Use the provider place ID, source URL, address, and reliable sources to identify the exact business.",
            "Before returning facts, identify the exact matched place in matchedPlace. A nearby landmark, park, similarly named branch, or broad search-query result is not the same place.",
            "matchedPlace must describe the page/entity from which the returned facts were taken, including its actual name, address, category, provider place ID when visible, confidence, and evidence URLs.",
            "Use official website, official social account, or official business page first; then major map or business pages; then trustworthy booking or travel platforms; use blogs only as a last resort.",
            "Research only these normalized fields when requested: name, address, roadAddress, category, phone, openingHours, closedDays, menu, recommendedOrder, priceRange, parking, description, websiteUrl, and coordinates.",
            "For menu, identify signature items, set or course composition, and prices only when a cited source states them.",
            "priceRange means a verified approximate per-person spend or average check. Do not derive it from the cheapest and most expensive menu items unless a source explicitly describes per-person spending.",
            "Mark a menu as popular only when multiple independent visitor sources repeatedly mention ordering it; a menu's display order is not popularity evidence.",
            "recommendedOrder is only for a first-time order supported by an official recommendation or repeated ordering evidence. Otherwise return null.",
            "When current menu prices conflict, prefer the newest official source. Mark priceApproximate or priceRange.approximate true when the cited price is approximate or source dates cannot establish an exact current price.",
            "The description field is a one-to-three sentence factual short description, not advertising copy.",
            "Return coordinates only when an official map or official business source clearly identifies the exact place and coordinates.",
            "Do not search for or return images. Do not infer atmosphere, popularity, taste, menu quality, views, or recommendations without the explicit menu evidence rules above.",
            "Return null with confidence 0 when a fact cannot be verified. If sources conflict or may be stale, return the candidate with confidence below 0.75 so it will not be auto-applied.",
            "Confidence must reflect source quality, agreement, recency, and place identity. Include source URLs for every non-null fact.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `장소의 누락 정보만 조사하세요.\n\n장소 사실정보:\n${JSON.stringify({
            name: place.name,
            address: place.roadAddress ?? place.address,
            category: place.category,
            provider: place.provider,
            providerSourceUrl: place.sourceUrl,
            providerPlaceId: place.providerPlaceId,
            providerLookupQuery: place.lookupQuery,
            existingSearchHints: normalizeSearchHints(hints),
            missingFields,
          }, null, 2)}`,
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "missing_place_data",
          strict: true,
          schema: webSearchSchema,
        },
      },
      reasoning: { effort: "low" },
      max_output_tokens: 1_600,
      store: false,
    });

    const parsed = parseJson(response.output_text);
    const responseSources = extractResponseSources(response);
    const rawData = normalizeWebSearchData(parsed, responseSources);
    const identity = verifyWebSearchPlaceIdentity(place, hints, parsed.matchedPlace, rawData.sources);
    const data: WebSearchEnrichmentData = identity.matched ? rawData : { sources: rawData.sources };
    const searchedAt = new Date().toISOString();
    const needsReviewFields = missingFields.filter((field) => {
      const candidate = rawData[field];
      if (!identity.matched) return candidate?.value !== null && candidate?.value !== undefined;
      const threshold = ["coordinates", "openingHours", "closedDays", "menu", "recommendedOrder", "priceRange", "parking"].includes(field)
        ? WEB_SEARCH_VOLATILE_CONFIDENCE
        : 0.75;
      return Boolean(candidate?.value !== null && candidate?.value !== undefined && (candidate.confidence ?? 0) < threshold);
    });

    return {
      data,
      identity,
      searchedFields: missingFields,
      needsReviewFields,
      sources: data.sources,
      model,
      searchedAt,
    };
  } catch (error) {
    throw toPublicOpenAiError(error, "장소 정보 웹 검색 보완");
  }
}

function normalizeSearchHints(hints: PlaceWebSearchHints) {
  return {
    ...normalizeSearchHint("name", hints.name),
    ...normalizeSearchHint("address", hints.address),
    ...normalizeSearchHint("category", hints.category),
  };
}

function normalizeSearchHint<Key extends keyof PlaceWebSearchHints>(key: Key, value: unknown) {
  return typeof value === "string" && value.trim() ? { [key]: value.trim().slice(0, 300) } : {};
}

const factSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"] },
    confidence: { type: "number" },
    sourceUrls: { type: "array", items: { type: "string" } },
  },
  required: ["value", "confidence", "sourceUrls"],
} as const;

const nullableBooleanFactSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["boolean", "null"] },
    confidence: { type: "number" },
    sourceUrls: { type: "array", items: { type: "string" } },
  },
  required: ["value", "confidence", "sourceUrls"],
} as const;

const coordinatesFactSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["latitude", "longitude"],
    },
    confidence: { type: "number" },
    sourceUrls: { type: "array", items: { type: "string" } },
  },
  required: ["value", "confidence", "sourceUrls"],
} as const;

const menuFactSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: {
      type: ["array", "null"],
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          price: { type: ["number", "null"] },
          priceApproximate: { type: "boolean" },
          role: { type: "string", enum: ["signature", "popular", "set", "course", "other"] },
          composition: { type: "array", items: { type: "string" } },
          reviewHighlights: { type: "array", items: { type: "string" } },
        },
        required: ["name", "price", "priceApproximate", "role", "composition", "reviewHighlights"],
      },
    },
    confidence: { type: "number" },
    sourceUrls: { type: "array", items: { type: "string" } },
  },
  required: ["value", "confidence", "sourceUrls"],
} as const;

const priceRangeFactSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        min: { type: ["number", "null"] },
        max: { type: ["number", "null"] },
        approximate: { type: "boolean" },
      },
      required: ["min", "max", "approximate"],
    },
    confidence: { type: "number" },
    sourceUrls: { type: "array", items: { type: "string" } },
  },
  required: ["value", "confidence", "sourceUrls"],
} as const;

const webSearchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    matchedPlace: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        providerPlaceId: { type: ["string", "null"] },
        confidence: { type: "number" },
        sourceUrls: { type: "array", items: { type: "string" } },
      },
      required: ["name", "address", "category", "providerPlaceId", "confidence", "sourceUrls"],
    },
    name: factSchema,
    category: factSchema,
    address: factSchema,
    roadAddress: factSchema,
    coordinates: coordinatesFactSchema,
    phone: factSchema,
    openingHours: factSchema,
    closedDays: factSchema,
    menu: menuFactSchema,
    recommendedOrder: {
      type: "object",
      additionalProperties: false,
      properties: {
        value: { type: ["array", "null"], items: { type: "string" } },
        confidence: { type: "number" },
        sourceUrls: { type: "array", items: { type: "string" } },
      },
      required: ["value", "confidence", "sourceUrls"],
    },
    priceRange: priceRangeFactSchema,
    parking: nullableBooleanFactSchema,
    description: factSchema,
    websiteUrl: factSchema,
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          type: { type: "string", enum: ["OFFICIAL", "MAP", "PLATFORM", "BLOG", "OTHER"] },
        },
        required: ["title", "url", "type"],
      },
    },
  },
  required: ["matchedPlace", "name", "category", "address", "roadAddress", "coordinates", "phone", "openingHours", "closedDays", "menu", "recommendedOrder", "priceRange", "parking", "description", "websiteUrl", "sources"],
} as const;

function parseJson(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    throw new Error("Web Search 구조화 응답을 해석하지 못했습니다.");
  }
}

function normalizeWebSearchData(value: Record<string, unknown>, responseSources: PlaceSourceCitation[]): WebSearchEnrichmentData {
  const data: WebSearchEnrichmentData = { sources: normalizeSources(value.sources, responseSources) };
  for (const field of placeDraftFields) {
    const raw = value[field];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    const candidate = {
      value: record.value ?? null,
      confidence: typeof record.confidence === "number" ? record.confidence : 0,
      sourceUrls: Array.isArray(record.sourceUrls) ? record.sourceUrls.filter((url): url is string => typeof url === "string") : [],
    } satisfies WebSearchFact<unknown>;
    data[field] = candidate;
  }

  return data;
}

function extractResponseSources(response: unknown) {
  const output = response && typeof response === "object" && "output" in response ? response.output : undefined;
  if (!Array.isArray(output)) return [];
  const sources: PlaceSourceCitation[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object" || !((item as Record<string, unknown>).type === "web_search_call")) continue;
    const action = (item as Record<string, unknown>).action;
    if (!action || typeof action !== "object") continue;
    const rawSources = (action as Record<string, unknown>).sources;
    if (Array.isArray(rawSources)) sources.push(...normalizeSources(rawSources, []));
  }
  return sources;
}

function normalizeSources(value: unknown, fallback: PlaceSourceCitation[]) {
  const rawValues = [...(Array.isArray(value) ? value : []), ...fallback];
  const sources = rawValues.flatMap((item) => {
    if (typeof item === "string") return /^https?:\/\//i.test(item) ? [{ url: item }] : [];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" && /^https?:\/\//i.test(record.url) ? record.url : "";
    return url ? [{
      title: typeof record.title === "string" ? record.title.slice(0, 200) : undefined,
      url,
      type: normalizeSourceType(record.type),
    }] : [];
  });
  return Array.from(new Map(sources.map((source) => [source.url, source])).values()).slice(0, 10);
}

function normalizeSourceType(value: unknown): PlaceSourceCitation["type"] {
  return value === "OFFICIAL" || value === "MAP" || value === "PLATFORM" || value === "BLOG" || value === "OTHER" ? value : "OTHER";
}

export function verifyWebSearchPlaceIdentity(
  place: PlaceDraft,
  hints: PlaceWebSearchHints,
  value: unknown,
  sources: PlaceSourceCitation[] = [],
): PlaceWebSearchIdentity {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const name = normalizeIdentityText(record.name);
  const address = normalizeIdentityText(record.address);
  const category = normalizeIdentityText(record.category);
  const providerPlaceId = normalizeIdentityText(record.providerPlaceId);
  const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
    ? Math.min(1, Math.max(0, record.confidence))
    : 0;
  const sourceUrls = Array.from(new Set([
    ...(Array.isArray(record.sourceUrls) ? record.sourceUrls : []),
    ...sources.map((source) => source.url),
  ].filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url)))).slice(0, 10);
  const expectedName = place.name?.trim() || hints.name?.trim() || "";
  const expectedAddress = place.roadAddress?.trim() || place.address?.trim() || hints.address?.trim() || "";
  const expectedCategory = place.category?.trim() || hints.category?.trim() || "";
  const expectedId = place.providerPlaceId?.trim() || "";
  const idMatched = Boolean(expectedId && (
    providerPlaceId === expectedId || sourceUrls.some((url) => url.includes(encodeURIComponent(expectedId)) || url.includes(expectedId))
  ));
  const nameMatched = Boolean(expectedName && name && identityNameMatches(expectedName, name));
  const addressMatched = Boolean(expectedAddress && address && identityAddressMatches(expectedAddress, address));
  const categoryMatched = identityCategoryMatches(expectedCategory, category);

  const base = { confidence, name: name || undefined, address: address || undefined, category: category || undefined, providerPlaceId: providerPlaceId || undefined, sourceUrls };
  if (confidence < WEB_SEARCH_VOLATILE_CONFIDENCE) return { ...base, matched: false, reason: "웹검색 장소 식별 신뢰도가 부족합니다." };
  if (!sourceUrls.length) return { ...base, matched: false, reason: "웹검색 장소 식별 출처가 없습니다." };
  if (expectedName && !nameMatched) return { ...base, matched: false, reason: "웹검색 상호명이 등록 장소와 일치하지 않습니다." };
  if (!categoryMatched) return { ...base, matched: false, reason: "웹검색 장소 카테고리가 등록 장소와 일치하지 않습니다." };
  if (expectedAddress && !addressMatched && !idMatched) return { ...base, matched: false, reason: "웹검색 주소가 등록 장소와 일치하지 않습니다." };
  if (!idMatched && !(nameMatched && addressMatched)) {
    return { ...base, matched: false, reason: "동일한 장소임을 확인할 상호명·주소 또는 Place ID 근거가 부족합니다." };
  }
  return { ...base, matched: true, reason: idMatched ? "Provider Place ID가 일치합니다." : "상호명과 주소가 일치합니다." };
}

function normalizeIdentityText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

function identityNameMatches(expected: string, actual: string) {
  const left = compactIdentityText(expected);
  const right = compactIdentityText(actual);
  return left.length >= 3 && right.length >= 3 && (left === right || left.includes(right) || right.includes(left));
}

function identityAddressMatches(expected: string, actual: string) {
  const left = compactIdentityText(expected);
  const right = compactIdentityText(actual);
  if (left.length >= 6 && right.length >= 6 && (left.includes(right) || right.includes(left))) return true;
  const ignored = new Set(["대한민국", "한국", "부산", "부산광역시"]);
  const expectedTokens = new Set(tokenizeIdentityText(expected).filter((token) => !ignored.has(token)));
  const actualTokens = new Set(tokenizeIdentityText(actual).filter((token) => !ignored.has(token)));
  const common = [...expectedTokens].filter((token) => actualTokens.has(token));
  return common.length >= 2;
}

function identityCategoryMatches(expected: string, actual: string) {
  const expectedFamily = categoryFamily(expected);
  const actualFamily = categoryFamily(actual);
  return !expectedFamily || !actualFamily || expectedFamily === actualFamily;
}

function categoryFamily(value: string) {
  const normalized = value.toLowerCase();
  if (/(cafe|coffee|bakery|카페|커피|베이커리)/.test(normalized)) return "cafe";
  if (/(restaurant|food|한식|중식|일식|음식점|식당|고기|국밥)/.test(normalized)) return "restaurant";
  if (/(bar|pub|술집|주점|호프|와인)/.test(normalized)) return "bar";
  if (/(park|beach|museum|attraction|공원|해변|박물관|관광|명소)/.test(normalized)) return "attraction";
  return "";
}

function compactIdentityText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function tokenizeIdentityText(value: string) {
  return value.normalize("NFKC").toLowerCase().match(/[0-9a-z가-힣]+/g) ?? [];
}
