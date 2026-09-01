import OpenAI from "openai";
import { publicOpenAiValidationError, toPublicOpenAiError } from "@/lib/openai-errors";
import type { NormalizedPlace, SupportedPlaceProvider } from "@/lib/place-providers/types";

const defaultModel = "gpt-5.6-luna";
const requestTimeoutMs = 20_000;
const summaryCacheTtlMs = 10 * 60 * 1000;
const summaryCache = new Map<string, { expiresAt: number; value: Promise<AdminPlaceSummaryResult> }>();
const unsupportedClaims = [
  "현지인 맛집",
  "맛집",
  "웨이팅",
  "분위기",
  "오션뷰",
  "바다 뷰",
  "매우 인기",
  "유명한",
  "실패 없는",
  "꼭 가",
  "최고의",
  "강력 추천",
];

export type AdminPlaceSummaryFacts = {
  provider: SupportedPlaceProvider;
  name: string;
  category?: string;
  types?: string[];
  providerDescription?: string;
  address?: string;
  openingHours?: string[];
  closedDays?: string[];
  menu?: Array<{
    name: string;
    price?: number;
    priceApproximate?: boolean;
    role?: "signature" | "popular" | "set" | "course" | "other";
    composition?: string[];
    reviewHighlights?: string[];
  }>;
  recommendedOrder?: string[];
  parking?: boolean;
  priceLevel?: number;
  priceRange?: { min?: number; max?: number; currency?: string; approximate?: boolean };
  rating?: number;
  reviewCount?: number;
  website?: string;
};

export type AdminPlaceSummaryResult = {
  summaryKo: string;
  model: string;
  generatedAt: string;
};

export async function generateAdminPlaceSummaryCached(place: NormalizedPlace) {
  const key = JSON.stringify(buildAdminPlaceSummaryFacts(place));
  const now = Date.now();
  const cached = summaryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = generateAdminPlaceSummary(place);
  summaryCache.set(key, { expiresAt: now + summaryCacheTtlMs, value });
  try {
    return await value;
  } catch (error) {
    summaryCache.delete(key);
    throw error;
  }
}

export function buildAdminPlaceSummaryFacts(place: NormalizedPlace): AdminPlaceSummaryFacts {
  const openingHours = normalizeStringArray(place.openingHours ?? place.currentOpeningHours);
  const closedDays = normalizeStringArray(place.closedDays);
  const priceRange = place.priceRange ?? (
    place.priceMin !== undefined || place.priceMax !== undefined
      ? { min: place.priceMin, max: place.priceMax, currency: "KRW" }
      : undefined
  );

  return pruneUndefined({
    provider: place.provider,
    name: cleanText(place.name, 160),
    category: cleanOptionalText(place.category, 160),
    types: place.types?.map((value) => cleanText(value, 100)).filter(Boolean).slice(0, 12),
    providerDescription: cleanOptionalText(place.description, 400),
    address: cleanOptionalText(place.roadAddressKo ?? place.addressKo ?? place.formattedAddress, 300),
    openingHours,
    closedDays,
    menu: place.menu?.slice(0, 20),
    recommendedOrder: place.recommendedOrder?.slice(0, 6),
    parking: typeof place.amenities?.parking === "boolean" ? place.amenities.parking : undefined,
    priceLevel: validPriceLevel(place.priceLevel),
    priceRange,
    rating: finiteNumber(place.rating),
    reviewCount: finiteNumber(place.reviewCount),
    website: cleanOptionalText(place.website, 500),
  }) as AdminPlaceSummaryFacts;
}

export async function generateAdminPlaceSummary(place: NormalizedPlace): Promise<AdminPlaceSummaryResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");

  const facts = buildAdminPlaceSummaryFacts(place);
  if (!facts.name) throw new Error("AI 장소 요약에는 provider 장소명이 필요합니다.");

  const model = process.env.OPENAI_PLACE_MODEL || process.env.OPENAI_SUMMARY_MODEL || defaultModel;
  const client = new OpenAI({ apiKey, timeout: requestTimeoutMs, maxRetries: 0 });
  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            "You write a short Korean factual summary for a place administrator.",
            "You must only summarize facts contained in the provided place data.",
            "Do not infer missing features, atmosphere, menu quality, popularity, waiting time, views, suitability, or customer experience.",
            "Do not write advertising language, recommendations, superlatives, or unsupported evaluations.",
            "Write 2 to 4 concise Korean sentences. Omit unavailable facts.",
            "If rating or review count is mentioned, explicitly identify the map provider as the source and make no value judgment.",
            "Do not introduce any number that is absent from the provided JSON.",
            "When verified menu data exists, naturally mention signature or repeatedly ordered menu items, their stated or approximate prices, and set/course composition.",
            "Mention a first-time order only when recommendedOrder is present. Treat reviewHighlights as repeated observations, not universal quality claims.",
            "When priceApproximate or priceRange.approximate is true, use Korean wording such as '약' or '대략'.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `다음 장소 사실정보만 객관적으로 요약하세요.\n\n${JSON.stringify(facts, null, 2)}`,
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "admin_place_summary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { summaryKo: { type: "string" } },
            required: ["summaryKo"],
          },
        },
      },
      reasoning: { effort: "low" },
      max_output_tokens: 400,
      store: false,
    });

    const parsed = JSON.parse(response.output_text || "{}") as { summaryKo?: unknown };
    const summaryKo = cleanText(parsed.summaryKo, 800);
    validateAdminPlaceSummary(summaryKo, facts);

    return { summaryKo, model, generatedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("AI 장소 요약")) {
      throw publicOpenAiValidationError(`${error.message} 다시 생성해 주세요.`);
    }
    throw toPublicOpenAiError(error, "AI 장소 요약 생성");
  }
}

export function validateAdminPlaceSummary(summary: string, facts: AdminPlaceSummaryFacts) {
  if (!summary || summary.length < 20) throw new Error("AI 장소 요약이 너무 짧거나 비어 있습니다.");
  if (!/[가-힣]/.test(summary)) throw new Error("AI 장소 요약이 한국어로 생성되지 않았습니다.");

  const sentenceCount = summary.split(/[.!?]+(?:\s|$)/).map((value) => value.trim()).filter(Boolean).length;
  if (sentenceCount < 2 || sentenceCount > 4) throw new Error("AI 장소 요약은 2~4문장이어야 합니다.");

  const unsupported = unsupportedClaims.find((claim) => summary.includes(claim));
  if (unsupported) throw new Error(`AI 장소 요약에 근거 없는 표현이 포함되었습니다: ${unsupported}`);

  const hasMenuPrice = facts.menu?.some((item) => item.price !== undefined) ?? false;
  if (facts.priceLevel === undefined && !facts.priceRange && !hasMenuPrice && /(가격|원\b|무료)/.test(summary)) {
    throw new Error("가격 정보가 없는 장소에 가격 표현을 생성했습니다.");
  }
  if (!facts.openingHours?.length && /(영업|운영 시간|오픈|마감)/.test(summary)) {
    throw new Error("영업시간 정보가 없는 장소에 영업시간 표현을 생성했습니다.");
  }
  if (facts.rating === undefined && /(평점|별점)/.test(summary)) {
    throw new Error("평점 정보가 없는 장소에 평점 표현을 생성했습니다.");
  }
  if (facts.reviewCount === undefined && /리뷰\s*[0-9]/.test(summary)) {
    throw new Error("리뷰 수가 없는 장소에 리뷰 수를 생성했습니다.");
  }
  if (!(facts.menu?.some((item) => item.role === "popular" || item.reviewHighlights?.length) ?? false) && /인기 메뉴/.test(summary)) {
    throw new Error("반복 리뷰 근거가 없는 장소에 인기 메뉴 표현을 생성했습니다.");
  }
  if (!facts.recommendedOrder?.length && /(처음 방문|첫 방문).{0,20}(주문|선택|추천)/.test(summary)) {
    throw new Error("추천 주문 근거가 없는 장소에 첫 방문 추천을 생성했습니다.");
  }

  const allowedNumbers = new Set((JSON.stringify(facts).match(/\d+(?:[.,]\d+)*/g) ?? []).map(normalizeNumberToken));
  const generatedNumbers = (summary.match(/\d+(?:[.,]\d+)*/g) ?? []).map(normalizeNumberToken);
  if (generatedNumbers.some((value) => !allowedNumbers.has(value))) {
    throw new Error("AI 장소 요약에 provider 사실정보에 없는 수치가 포함되었습니다.");
  }
}

function normalizeStringArray(value: string | string[] | undefined) {
  if (!value) return undefined;
  const items = (Array.isArray(value) ? value : value.split("\n"))
    .map((item) => cleanText(item, 160))
    .filter(Boolean)
    .slice(0, 14);
  return items.length ? items : undefined;
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanOptionalText(value: unknown, limit: number) {
  return cleanText(value, limit) || undefined;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function validPriceLevel(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4 ? value : undefined;
}

function normalizeNumberToken(value: string) {
  return value.replaceAll(",", "").replace(/^0+(?=\d)/, "");
}

function pruneUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && (!Array.isArray(item) || item.length > 0)));
}
