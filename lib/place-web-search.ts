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
  searchedFields: PlaceDraftField[];
  needsReviewFields: PlaceDraftField[];
  sources: PlaceSourceCitation[];
  model: string;
  searchedAt: string;
};

export async function searchMissingPlaceDataCached(place: PlaceDraft, missingFields: PlaceDraftField[]) {
  const key = JSON.stringify({
    provider: place.provider,
    placeId: place.providerPlaceId,
    sourceUrl: place.sourceUrl,
    lookupQuery: place.lookupQuery,
    name: place.name,
    address: place.roadAddress ?? place.address,
    category: place.category,
    missingFields,
  });
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = searchMissingPlaceData(place, missingFields);
  searchCache.set(key, { expiresAt: Date.now() + webSearchCacheTtlMs, value });
  try {
    return await value;
  } catch (error) {
    searchCache.delete(key);
    throw error;
  }
}

export async function searchMissingPlaceData(place: PlaceDraft, missingFields: PlaceDraftField[]): Promise<PlaceWebSearchResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  if (!missingFields.length) {
    return {
      data: { sources: [] },
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
            "Use official website, official social account, or official business page first; then major map or business pages; then trustworthy booking or travel platforms; use blogs only as a last resort.",
            "Do not search for or return images. Do not infer atmosphere, popularity, taste, menu quality, views, or recommendations.",
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
      max_output_tokens: 900,
      store: false,
    });

    const parsed = parseJson(response.output_text);
    const responseSources = extractResponseSources(response);
    const data = normalizeWebSearchData(parsed, responseSources);
    const searchedAt = new Date().toISOString();
    const needsReviewFields = missingFields.filter((field) => {
      const candidate = data[field];
      const threshold = ["coordinates", "openingHours", "closedDays", "menu", "priceRange", "parking"].includes(field)
        ? WEB_SEARCH_VOLATILE_CONFIDENCE
        : 0.75;
      return Boolean(candidate?.value !== null && candidate?.value !== undefined && (candidate.confidence ?? 0) < threshold);
    });

    return {
      data,
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
        },
        required: ["name", "price"],
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
      },
      required: ["min", "max"],
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
    name: factSchema,
    category: factSchema,
    address: factSchema,
    roadAddress: factSchema,
    coordinates: coordinatesFactSchema,
    phone: factSchema,
    openingHours: factSchema,
    closedDays: factSchema,
    menu: menuFactSchema,
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
  required: ["name", "category", "address", "roadAddress", "coordinates", "phone", "openingHours", "closedDays", "menu", "priceRange", "parking", "description", "websiteUrl", "sources"],
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
