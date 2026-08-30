import OpenAI from "openai";
import { analyzePlaceMapSource } from "@/lib/place-ai/map-source";
import { normalizePlaceAiGeneratedContent, toPlaceAiGenerationApiContent } from "@/lib/place-ai/content-draft";
import type { PlaceAiGeneratedContent, PlaceAiGenerationRequest, PlaceAiGenerationResponse, PlaceSourceData } from "@/types/place-ai";
import { placeCategories, type PlaceCategory, type PlaceFactTristate, type PlaceSourceProvider } from "@/types/database";

const defaultPlaceModel = "gpt-5.6-luna";
const maxRequestBytes = 24_000;
const maxSourceJsonLength = 9_000;
const requestTimeoutMs = 25_000;
const maxOutputTokens = 1_200;
const contentVersion = "place-ai-v1";

export type PlaceAiGenerationErrorCode =
  | "missing_api_key"
  | "invalid_request"
  | "source_data_missing"
  | "openai_rate_limited"
  | "openai_timeout"
  | "openai_failed"
  | "schema_validation_failed";

export class PlaceAiGenerationError extends Error {
  code: PlaceAiGenerationErrorCode;
  status: number;
  expose: boolean;

  constructor(code: PlaceAiGenerationErrorCode, message: string, status = 400, expose = true) {
    super(message);
    this.name = "PlaceAiGenerationError";
    this.code = code;
    this.status = status;
    this.expose = expose;
  }
}

type IncomingPlaceAiGenerationBody = Partial<PlaceAiGenerationRequest> & {
  sourceData?: Partial<PlaceSourceData> & Record<string, unknown>;
  localeTargets?: PlaceAiGenerationRequest["locale_targets"];
  existingContent?: PlaceAiGenerationRequest["existing_content"];
};

export function normalizePlaceAiGenerationRequest(body: IncomingPlaceAiGenerationBody): PlaceAiGenerationRequest {
  const sourceData = body.source_data ?? body.sourceData;

  if (!sourceData) {
    throw new PlaceAiGenerationError("source_data_missing", "sourceData가 필요합니다.", 400);
  }

  const normalizedSourceData = normalizeSourceData(sourceData);
  const localeTargets = body.locale_targets ?? body.localeTargets ?? ["ko", "zh", "en", "ja"];

  return {
    source_data: normalizedSourceData,
    locale_targets: localeTargets.filter((locale): locale is "ko" | "zh" | "en" | "ja" =>
      locale === "ko" || locale === "zh" || locale === "en" || locale === "ja",
    ),
    existing_content: body.existing_content ?? body.existingContent,
  };
}

export function assertPlaceAiRequestSize(body: unknown) {
  const size = Buffer.byteLength(JSON.stringify(body), "utf8");

  if (size > maxRequestBytes) {
    throw new PlaceAiGenerationError("invalid_request", "AI 생성 요청이 너무 큽니다. 메뉴/메모를 줄여 주세요.", 413);
  }
}

export async function generatePlaceAiContent(request: PlaceAiGenerationRequest): Promise<PlaceAiGenerationResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new PlaceAiGenerationError("missing_api_key", "OPENAI_API_KEY가 설정되어 있지 않습니다.", 503);
  }

  const sourceData = normalizeSourceData(request.source_data);
  const sourcePayload = pruneEmptyValues({
    ...sourceData,
    existing_content: normalizePlaceAiGeneratedContent(request.existing_content),
  });
  const sourceJson = JSON.stringify(sourcePayload, null, 2).slice(0, maxSourceJsonLength);
  const model = process.env.OPENAI_PLACE_MODEL || defaultPlaceModel;
  const client = new OpenAI({
    apiKey,
    timeout: requestTimeoutMs,
    maxRetries: 0,
  });

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(sourceJson),
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "place_ai_generated_content",
          strict: true,
          schema: placeAiGeneratedContentSchema,
        },
      },
      reasoning: {
        effort: "minimal",
      },
      max_output_tokens: maxOutputTokens,
      store: false,
    });

    const content = parseAndValidateGeneratedContent(response.output_text);
    const apiContent = toPlaceAiGenerationApiContent(content);

    return {
      status: "generated",
      source_data: sourceData,
      generated_content: content,
      api_content: apiContent,
      description: apiContent.description,
      shortSummary: apiContent.shortSummary,
      highlights: apiContent.highlights,
      travelerTips: apiContent.travelerTips,
      recommendedFor: apiContent.recommendedFor,
      cautions: apiContent.cautions,
      model,
      generated_at: new Date().toISOString(),
      content_version: contentVersion,
      message: "AI 여행정보 초안을 생성했습니다. 내용을 검토한 뒤 적용하세요.",
    };
  } catch (error) {
    throw mapOpenAiError(error);
  }
}

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
};

const placeAiGeneratedContentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    description_ko: { type: "string" },
    description_zh: { type: "string" },
    description_en: { type: "string" },
    description_ja: { type: "string" },
    short_summary: { type: "string" },
    short_summary_ko: { type: "string" },
    short_summary_zh: { type: "string" },
    short_summary_en: { type: "string" },
    short_summary_ja: { type: "string" },
    highlights: stringArraySchema,
    traveler_tips: stringArraySchema,
    recommended_for: stringArraySchema,
    cautions: stringArraySchema,
  },
  required: [
    "description_ko",
    "description_zh",
    "description_en",
    "description_ja",
    "short_summary",
    "short_summary_ko",
    "short_summary_zh",
    "short_summary_en",
    "short_summary_ja",
    "highlights",
    "traveler_tips",
    "recommended_for",
    "cautions",
  ],
};

function normalizeSourceData(sourceData: Partial<PlaceSourceData> & Record<string, unknown>): PlaceSourceData {
  const name = normalizeText(sourceData.name, 160);
  const category = normalizeCategory(sourceData.category);
  const rawMapUrl = sourceData.map_url ?? sourceData.mapUrl;
  const rawExternalId = sourceData.source_external_id ?? sourceData.sourceExternalId;
  const rawOpeningHours = sourceData.opening_hours ?? sourceData.openingHours;
  const rawCardPayment = sourceData.card_payment ?? sourceData.cardPayment;
  const rawSoloFriendly = sourceData.solo_friendly ?? sourceData.soloFriendly;
  const rawWaitingInfo = sourceData.waiting_info ?? sourceData.waitingInfo;
  const rawNearestStation = sourceData.nearest_station ?? sourceData.nearestStation;

  if (!name) {
    throw new PlaceAiGenerationError("source_data_missing", "AI 생성에는 장소명이 필요합니다.", 400);
  }

  if (!category) {
    throw new PlaceAiGenerationError("source_data_missing", "AI 생성에는 올바른 카테고리가 필요합니다.", 400);
  }

  const mapUrl = normalizeText(rawMapUrl, 500);
  const mapFacts = analyzePlaceMapSource(mapUrl);
  const menu = Array.isArray(sourceData.menu)
    ? sourceData.menu.slice(0, 12).map((item) => {
        const record = asRecord(item) ?? {};

        return {
          name_ko: normalizeText(record.name_ko ?? record.nameKo, 120),
          name_zh: normalizeText(record.name_zh ?? record.nameZh, 120),
          description_zh: normalizeText(record.description_zh ?? record.descriptionZh, 180),
          price: normalizeNumber(record.price),
          is_recommended: record.is_recommended === true || record.isRecommended === true,
        };
      })
    : [];
  const price = asRecord(sourceData.price) ?? {};

  const normalized: PlaceSourceData = {
    name,
    category,
    address: normalizeText(sourceData.address, 300),
    latitude: normalizeNumber(sourceData.latitude),
    longitude: normalizeNumber(sourceData.longitude),
    map_url: mapUrl,
    provider: normalizeProvider(sourceData.provider, mapFacts.source_type),
    source_external_id: normalizeText(rawExternalId, 120) || null,
    nearest_station: normalizeText(rawNearestStation, 120),
    opening_hours: normalizeText(rawOpeningHours, 300),
    menu,
    price: {
      level: normalizeNumber(price.level),
      min: normalizeNumber(price.min),
      max: normalizeNumber(price.max),
    },
    parking: normalizeTristate(sourceData.parking),
    toilet: normalizeTristate(sourceData.toilet),
    card_payment: normalizeTristate(rawCardPayment),
    solo_friendly: normalizeTristate(rawSoloFriendly),
    waiting_info: normalizeText(rawWaitingInfo, 180),
    source: sourceData.source === "map_link" || mapUrl ? "map_link" : "admin_form",
    map_link_facts: mapFacts,
  };

  if (!hasMinimumUsefulFacts(normalized)) {
    throw new PlaceAiGenerationError("source_data_missing", "AI 설명을 생성하려면 장소명과 최소한의 장소 정보가 필요합니다.", 400);
  }

  return normalized;
}

function buildSystemPrompt() {
  return [
    "You are a precise place information editor for foreign travelers visiting Busan.",
    "Use only the facts in sourceData. Do not browse, scrape, infer from the URL, or invent missing facts.",
    "Do not fabricate prices, hours, menus, reviews, wait times, payment support, toilet, parking, popularity, or amenities.",
    "Avoid advertising exaggeration. Write practical travel copy.",
    "Generate Korean, Simplified Chinese, English, and Japanese. Do not mix languages.",
    "Chinese must be natural Simplified Chinese for mainland Chinese independent travelers.",
    "If a fact is unknown, omit it from descriptions. If important, add a short caution such as information confirmation needed.",
    "Separate business-provided facts from travel-editor judgment. Make judgment modest and based only on provided facts.",
    "When present, use location convenience, price, menu, portion, greasiness, spiciness, smell, wait, solo dining, card payment, toilet, parking, and cautions.",
    "Keep output concise: descriptions up to two short sentences per language, arrays up to five short items.",
    "Fill short_summary_ko, short_summary_zh, short_summary_en, and short_summary_ja in their own languages. short_summary can mirror Korean.",
  ].join("\n");
}

function buildUserPrompt(sourceJson: string) {
  return [
    "Create admin-reviewable place content from this normalized sourceData.",
    "Return only fields defined by the JSON schema.",
    "",
    sourceJson,
  ].join("\n");
}

function parseAndValidateGeneratedContent(text: string) {
  if (!text.trim()) {
    throw new PlaceAiGenerationError("schema_validation_failed", "OpenAI 응답이 비어 있습니다.", 502);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PlaceAiGenerationError("schema_validation_failed", "OpenAI 응답 JSON 파싱에 실패했습니다.", 502);
  }

  const record = asRecord(parsed);

  if (!record) {
    throw new PlaceAiGenerationError("schema_validation_failed", "OpenAI 응답 형식이 올바르지 않습니다.", 502);
  }

  const content = normalizePlaceAiGeneratedContent(record);
  const hasRequiredStrings = [
    content.description_ko,
    content.description_zh,
    content.description_en,
    content.description_ja,
    content.short_summary,
    content.short_summary_ko,
    content.short_summary_zh,
    content.short_summary_en,
    content.short_summary_ja,
  ].every((value) => value.length > 0);

  if (!hasRequiredStrings) {
    throw new PlaceAiGenerationError("schema_validation_failed", "OpenAI 응답에 필수 설명 필드가 없습니다.", 502);
  }

  return {
    ...content,
    highlights: content.highlights.slice(0, 5),
    traveler_tips: content.traveler_tips.slice(0, 5),
    recommended_for: content.recommended_for.slice(0, 5),
    cautions: content.cautions.slice(0, 5),
  };
}

function mapOpenAiError(error: unknown): PlaceAiGenerationError {
  if (error instanceof PlaceAiGenerationError) {
    return error;
  }

  const record = asRecord(error);
  const status = typeof record?.status === "number" ? record.status : undefined;
  const name = typeof record?.name === "string" ? record.name : "";

  if (status === 429) {
    return new PlaceAiGenerationError("openai_rate_limited", "OpenAI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.", 429);
  }

  if (name.toLowerCase().includes("timeout")) {
    return new PlaceAiGenerationError("openai_timeout", "OpenAI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.", 504);
  }

  if (status === 401 || status === 403) {
    return new PlaceAiGenerationError("openai_failed", "OpenAI API Key 권한을 확인해 주세요.", 502);
  }

  return new PlaceAiGenerationError("openai_failed", "OpenAI 장소 설명 생성에 실패했습니다.", 502);
}

function pruneEmptyValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(pruneEmptyValues).filter((item) => {
      if (item === null || item === "") return false;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object" && item !== null) return Object.keys(item).length > 0;
      return true;
    });
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, pruneEmptyValues(item)] as const)
        .filter(([, item]) => {
          if (item === null || item === "" || item === "unknown") return false;
          if (Array.isArray(item)) return item.length > 0;
          if (typeof item === "object" && item !== null) return Object.keys(item).length > 0;
          return true;
        }),
    );
  }

  return value;
}

function normalizeText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function normalizeNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function normalizeTristate(value: unknown): PlaceFactTristate {
  return value === "yes" || value === "no" || value === "unknown" ? value : "unknown";
}

function normalizeCategory(value: unknown): PlaceCategory | null {
  return typeof value === "string" && placeCategories.includes(value as PlaceCategory) ? (value as PlaceCategory) : null;
}

function normalizeProvider(value: unknown, sourceType: ReturnType<typeof analyzePlaceMapSource>["source_type"]): PlaceSourceProvider {
  if (value === "NAVER" || value === "KAKAO" || value === "GOOGLE" || value === "MANUAL") {
    return value;
  }

  if (sourceType === "naver") return "NAVER";
  if (sourceType === "kakao") return "KAKAO";
  if (sourceType === "google") return "GOOGLE";
  return "MANUAL";
}

function hasMinimumUsefulFacts(sourceData: PlaceSourceData) {
  return Boolean(
    sourceData.address ||
      sourceData.map_url ||
      sourceData.nearest_station ||
      sourceData.opening_hours ||
      sourceData.menu.some((item) => item.name_ko || item.name_zh || item.description_zh || item.price !== null) ||
      sourceData.price.level !== null ||
      sourceData.price.min !== null ||
      sourceData.price.max !== null ||
      sourceData.parking !== "unknown" ||
      sourceData.toilet !== "unknown" ||
      sourceData.card_payment !== "unknown" ||
      sourceData.solo_friendly !== "unknown" ||
      sourceData.waiting_info,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
