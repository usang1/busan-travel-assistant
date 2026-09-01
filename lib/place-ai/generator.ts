import OpenAI from "openai";
import { analyzePlaceMapSource } from "@/lib/place-ai/map-source";
import { normalizePlaceAiGeneratedContent, toPlaceAiGenerationApiContent } from "@/lib/place-ai/content-draft";
import { validateLocaleText } from "@/lib/place-ai/locale-validation";
import type { PlaceAiGeneratedContent, PlaceAiGenerationRequest, PlaceAiGenerationResponse, PlaceAiLocaleResult, PlaceContentLocale, PlaceSourceData } from "@/types/place-ai";
import { hasVisibleTravelerInsights, normalizeTravelerInsights } from "@/lib/traveler-insights";
import { placeCategories, type PlaceCategory, type PlaceFactTristate, type PlaceSourceProvider } from "@/types/database";

const defaultPlaceModel = "gpt-5.6-luna";
const maxRequestBytes = 24_000;
const maxSourceJsonLength = 9_000;
const requestTimeoutMs = 25_000;
const maxOutputTokens = 1_200;
const contentVersion = "place-ai-v2";

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
  const localeTargets = [...new Set(body.locale_targets ?? body.localeTargets ?? ["ko", "zh", "en", "ja"])]
    .filter((locale): locale is PlaceContentLocale => locale === "ko" || locale === "zh" || locale === "en" || locale === "ja");

  if (localeTargets.length === 0) {
    throw new PlaceAiGenerationError("invalid_request", "생성할 locale을 하나 이상 선택해 주세요.", 400);
  }

  return {
    source_data: normalizedSourceData,
    locale_targets: localeTargets,
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
          content: buildUserPrompt(sourceJson, request.locale_targets),
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
        effort: "low",
      },
      max_output_tokens: maxOutputTokens,
      store: false,
    });

    const { content, localeResults } = parseAndValidateGeneratedContent(
      response.output_text,
      request.locale_targets,
      request.existing_content,
      sourceData,
    );
    const apiContent = toPlaceAiGenerationApiContent(content);

    return {
      status: "generated",
      source_data: sourceData,
      generated_content: content,
      locale_results: localeResults,
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

const localizedTextSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ko: { type: "string" },
    zh: { type: "string" },
    en: { type: "string" },
    ja: { type: "string" },
  },
  required: ["ko", "zh", "en", "ja"],
};

const placeAiGeneratedContentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    description: localizedTextSchema,
    travel_tip: localizedTextSchema,
  },
  required: ["description", "travel_tip"],
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
  const rawAddressKo = sourceData.address_ko ?? sourceData.address;
  const rawFormattedAddress = sourceData.formatted_address ?? sourceData.formattedAddress;
  const rawAdminNotes = sourceData.admin_notes ?? sourceData.adminNotes;
  const rawProviderMetadata = sourceData.provider_metadata ?? sourceData.providerMetadata;

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
          price_approximate: record.price_approximate === true || record.priceApproximate === true,
          role: normalizeMenuRole(record.role),
          composition: normalizeStringArray(record.composition, 8, 120),
          review_highlights: normalizeStringArray(record.review_highlights ?? record.reviewHighlights, 6, 160),
        };
      })
    : [];
  const recommendedOrder = normalizeStringArray(sourceData.recommended_order ?? sourceData.recommendedOrder, 6, 240);
  const price = asRecord(sourceData.price) ?? {};

  const normalized: PlaceSourceData = {
    name,
    category,
    address: normalizeText(sourceData.address, 300),
    address_ko: normalizeText(rawAddressKo, 300),
    formatted_address: normalizeText(rawFormattedAddress, 300),
    latitude: normalizeNumber(sourceData.latitude),
    longitude: normalizeNumber(sourceData.longitude),
    map_url: mapUrl,
    provider: normalizeProvider(sourceData.provider, mapFacts.source_type),
    source_external_id: normalizeText(rawExternalId, 120) || null,
    nearest_station: normalizeText(rawNearestStation, 120),
    opening_hours: normalizeText(rawOpeningHours, 300),
    menu,
    recommended_order: recommendedOrder,
    price: {
      level: normalizeNumber(price.level),
      min: normalizeNumber(price.min),
      max: normalizeNumber(price.max),
    },
    parking: normalizeTristate(sourceData.parking),
    toilet: normalizeTristate(sourceData.toilet),
    card_payment: normalizeTristate(rawCardPayment),
    solo_friendly: normalizeTristate(rawSoloFriendly),
    traveler_insights: normalizeTravelerInsights(sourceData.traveler_insights ?? sourceData.travelerInsights),
    waiting_info: normalizeText(rawWaitingInfo, 180),
    admin_notes: normalizeText(rawAdminNotes, 1_200),
    provider_metadata: asRecord(rawProviderMetadata),
    source: sourceData.source === "map_link" || mapUrl ? "map_link" : "admin_form",
    map_link_facts: mapFacts,
  };

  if (!hasMinimumUsefulFacts(normalized)) {
    throw new PlaceAiGenerationError("source_data_missing", "AI 설명을 생성하려면 장소명과 최소한의 장소 정보가 필요합니다.", 400);
  }

  return normalized;
}

export function buildSystemPrompt() {
  return [
    "You are a precise place information editor for foreign travelers visiting South Korea.",
    "Use only the facts in sourceData. Do not browse, scrape, infer from the URL, or invent missing facts.",
    "Do not fabricate prices, hours, menus, reviews, wait times, payment support, toilet, parking, popularity, or amenities.",
    "Admin notes are editorial leads, not verified facts. Reframe subjective or exaggerated wording into neutral travel-service copy.",
    "Never translate superlatives or hype literally, including claims like best, number one, must-visit, famous, or viral unless provider facts explicitly prove them.",
    "Avoid advertising exaggeration. Write practical travel copy.",
    "Generate Korean, Simplified Chinese, English, and Japanese. Do not mix languages.",
    "Chinese must be natural Simplified Chinese for mainland Chinese independent travelers.",
    "If a fact is unknown or an unchecked boolean, omit it completely. Never turn missing information into a warning or a negative claim.",
    "traveler_insights contains admin-verified structured facts. You may reference only its non-unknown values, and you must never infer, rewrite, or contradict those values.",
    "Do not mention solo suitability or advise solo visitors to confirm conditions unless solo_friendly is explicitly yes or no in sourceData.",
    "Separate business-provided facts from travel-editor judgment. Make judgment modest and based only on provided facts.",
    "When present, use location convenience, price, menu, portion, greasiness, spiciness, smell, wait, solo dining, card payment, toilet, parking, and cautions.",
    "When verified menu facts are present, include representative or repeatedly ordered dishes, stated prices, and set/course composition naturally in the description.",
    "Only suggest a first order when recommended_order is non-empty. Review highlights describe repeated mentions and must not be upgraded into universal taste or quality claims.",
    "Description: explain what the place is, its factual location, and key verified characteristics in up to two short sentences. Mention suitable travelers only when directly supported by sourceData.",
    "Travel tip: use only supported visit timing, transport, nearby route, waiting, photo, or usage facts. Return an empty string when no grounded tip exists.",
    "Keep road names, building numbers, prices, and proper nouns accurate. Do not translate or generate address fields in this response.",
    "Each locale must use its own language. A short Korean proper noun may remain when no established localized place name exists.",
  ].join("\n");
}

export function buildUserPrompt(sourceJson: string, localeTargets: PlaceContentLocale[]) {
  return [
    "Create admin-reviewable place content from this normalized sourceData.",
    `Generate only these locales: ${localeTargets.join(", ")}.`,
    "For non-target locales, return empty strings. Locale failures must not affect other locale values.",
    "Return only fields defined by the JSON schema.",
    "",
    sourceJson,
  ].join("\n");
}

export function parseAndValidateGeneratedContent(
  text: string,
  localeTargets: PlaceContentLocale[] = ["ko", "zh", "en", "ja"],
  existingContent: Partial<PlaceAiGeneratedContent> = {},
  sourceData?: Pick<PlaceSourceData, "solo_friendly">,
) {
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

  const descriptions = asRecord(record.description) ?? {};
  const travelTips = asRecord(record.travel_tip) ?? {};
  const existing = normalizePlaceAiGeneratedContent(existingContent);
  const content = normalizePlaceAiGeneratedContent(existing);
  const localeResults = {} as Record<PlaceContentLocale, PlaceAiLocaleResult>;

  for (const locale of ["ko", "zh", "en", "ja"] as const) {
    if (!localeTargets.includes(locale)) {
      localeResults[locale] = { status: "preserved", failed_fields: [], message: "재생성 대상이 아니어서 기존 값을 유지했습니다." };
      continue;
    }

    const description = removeUnsupportedSoloClaims(normalizeText(descriptions[locale], 800), locale, sourceData?.solo_friendly);
    const travelTip = removeUnsupportedSoloClaims(normalizeText(travelTips[locale], 800), locale, sourceData?.solo_friendly);
    const failedFields: Array<"description" | "travel_tip"> = [];
    const descriptionValidation = validateLocaleText(description, locale);
    const travelTipValidation = travelTip ? validateLocaleText(travelTip, locale) : { valid: false };

    if (descriptionValidation.valid) content[`description_${locale}`] = description;
    else failedFields.push("description");

    if (travelTipValidation.valid) content[`travel_tip_${locale}`] = travelTip;
    else failedFields.push("travel_tip");

    localeResults[locale] = buildLocaleResult(locale, failedFields);
  }

  return { content, localeResults };
}

function removeUnsupportedSoloClaims(text: string, locale: PlaceContentLocale, soloFriendly?: PlaceFactTristate) {
  if (!text || soloFriendly === "yes" || soloFriendly === "no") {
    return text;
  }

  const soloPattern = {
    ko: /(혼자|혼밥|1인)/i,
    zh: /(一个人|單人|单人|独自)/i,
    en: /\b(solo|alone|single diner|single diners|one person)\b/i,
    ja: /(一人|ひとり|単独)/i,
  }[locale];

  return text
    .split(/(?<=[.!?。！？])\s*/u)
    .filter((sentence) => !soloPattern.test(sentence))
    .join(" ")
    .trim();
}

function buildLocaleResult(locale: PlaceContentLocale, failedFields: Array<"description" | "travel_tip">): PlaceAiLocaleResult {
  const localeLabel = { ko: "한국어", zh: "중국어", en: "영어", ja: "일본어" }[locale];
  if (failedFields.length === 0) return { status: "generated", failed_fields: [], message: `${localeLabel} 설명과 팁을 생성했습니다.` };
  if (failedFields.length === 2) return { status: "failed", failed_fields: failedFields, message: `${localeLabel} 생성 결과를 검증하지 못했습니다.` };
  return { status: "partial", failed_fields: failedFields, message: `${localeLabel} 일부 필드만 생성했습니다.` };
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

  if (status === 400 || status === 404) {
    return new PlaceAiGenerationError("openai_failed", "OpenAI 모델 또는 요청 설정이 올바르지 않습니다. OPENAI_PLACE_MODEL과 배포 버전을 확인해 주세요.", 502);
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

function normalizeStringArray(value: unknown, limit: number, textLimit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim().slice(0, textLimit))
    .slice(0, limit);
}

function normalizeMenuRole(value: unknown): "signature" | "popular" | "set" | "course" | "other" | undefined {
  return value === "signature" || value === "popular" || value === "set" || value === "course" || value === "other"
    ? value
    : undefined;
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
      hasVisibleTravelerInsights(sourceData.traveler_insights) ||
      sourceData.waiting_info,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
