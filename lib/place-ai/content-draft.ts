import type {
  PlaceAiGeneratedContent,
  PlaceAiGenerationApiContent,
  PlaceAiGenerationRequest,
  PlaceAiGenerationResponse,
  PlaceSourceData,
} from "@/types/place-ai";
import type { PlaceFactTristate, PlacePayload } from "@/types/database";
import { analyzePlaceMapSource } from "@/lib/place-ai/map-source";

const emptyContent: PlaceAiGeneratedContent = {
  description_ko: "",
  description_zh: "",
  description_en: "",
  description_ja: "",
  travel_tip_ko: "",
  travel_tip_zh: "",
  travel_tip_en: "",
  travel_tip_ja: "",
  short_summary: "",
  short_summary_ko: "",
  short_summary_zh: "",
  short_summary_en: "",
  short_summary_ja: "",
  highlights: [],
  traveler_tips: [],
  recommended_for: [],
  cautions: [],
};

export function createEmptyPlaceAiGeneratedContent(): PlaceAiGeneratedContent {
  return {
    ...emptyContent,
    highlights: [],
    traveler_tips: [],
    recommended_for: [],
    cautions: [],
  };
}

export function hasPlaceAiGeneratedContent(content: Partial<PlaceAiGeneratedContent> | null | undefined) {
  if (!content) {
    return false;
  }

  return [
    content.description_ko,
    content.description_zh,
    content.description_en,
    content.description_ja,
    content.travel_tip_ko,
    content.travel_tip_zh,
    content.travel_tip_en,
    content.travel_tip_ja,
    content.short_summary,
    content.short_summary_ko,
    content.short_summary_zh,
    content.short_summary_en,
    content.short_summary_ja,
    ...(content.highlights ?? []),
    ...(content.traveler_tips ?? []),
    ...(content.recommended_for ?? []),
    ...(content.cautions ?? []),
  ].some((value) => typeof value === "string" && value.trim());
}

export function normalizePlaceAiGeneratedContent(content: Partial<PlaceAiGeneratedContent> = {}): PlaceAiGeneratedContent {
  return {
    description_ko: normalizeText(content.description_ko),
    description_zh: normalizeText(content.description_zh),
    description_en: normalizeText(content.description_en),
    description_ja: normalizeText(content.description_ja),
    travel_tip_ko: normalizeText(content.travel_tip_ko),
    travel_tip_zh: normalizeText(content.travel_tip_zh),
    travel_tip_en: normalizeText(content.travel_tip_en),
    travel_tip_ja: normalizeText(content.travel_tip_ja),
    short_summary: normalizeText(content.short_summary),
    short_summary_ko: normalizeText(content.short_summary_ko),
    short_summary_zh: normalizeText(content.short_summary_zh),
    short_summary_en: normalizeText(content.short_summary_en),
    short_summary_ja: normalizeText(content.short_summary_ja),
    highlights: normalizeTextArray(content.highlights),
    traveler_tips: normalizeTextArray(content.traveler_tips),
    recommended_for: normalizeTextArray(content.recommended_for),
    cautions: normalizeTextArray(content.cautions),
  };
}

export function buildPlaceSourceData(payload: PlacePayload, options: { adminNotes?: string; formattedAddress?: string } = {}): PlaceSourceData {
  const chinaInfo = payload.china_info ?? null;

  return {
    name: payload.name_ko || payload.name_zh,
    category: payload.category,
    address: payload.address_ko || payload.address_zh || payload.address || "",
    address_ko: payload.address_ko,
    formatted_address: options.formattedAddress?.trim() || payload.address || "",
    latitude: payload.latitude,
    longitude: payload.longitude,
    map_url: payload.source?.source_url ?? "",
    provider: payload.source?.provider ?? "MANUAL",
    source_external_id: payload.source?.external_id ?? null,
    nearest_station: payload.nearest_station,
    opening_hours: payload.opening_hours,
    menu: payload.menu_items.map((item) => ({
      name_ko: item.name_ko,
      name_zh: item.name_zh,
      description_zh: item.description_zh,
      price: item.price,
      is_recommended: item.is_recommended,
    })),
    price: {
      level: payload.price_level ?? null,
      min: payload.price_min,
      max: payload.price_max,
    },
    parking: "unknown",
    toilet: chinaInfo?.toilet_available ?? "unknown",
    card_payment: chinaInfo?.foreign_card ?? booleanToTristate(payload.card_payment),
    solo_friendly: chinaInfo?.solo_friendly ?? booleanToTristate(payload.solo_friendly),
    waiting_info: payload.waiting_info_ko || payload.waiting_info_zh || chinaInfo?.waiting_level || "",
    admin_notes: options.adminNotes?.trim() || "",
    provider_metadata: payload.source?.raw_metadata ?? null,
    source: payload.source?.source_url ? "map_link" : "admin_form",
    map_link_facts: analyzePlaceMapSource(payload.source?.source_url ?? ""),
  };
}

export function buildPreparedAiGenerationResponse(request: PlaceAiGenerationRequest): PlaceAiGenerationResponse {
  const generatedContent = normalizePlaceAiGeneratedContent(request.existing_content);
  const apiContent = toPlaceAiGenerationApiContent(generatedContent);

  return {
    status: "prepared",
    source_data: request.source_data,
    generated_content: generatedContent,
    locale_results: {
      ko: { status: "preserved", failed_fields: [], message: "기존 한국어 내용을 유지합니다." },
      zh: { status: "preserved", failed_fields: [], message: "기존 중국어 내용을 유지합니다." },
      en: { status: "preserved", failed_fields: [], message: "기존 영어 내용을 유지합니다." },
      ja: { status: "preserved", failed_fields: [], message: "기존 일본어 내용을 유지합니다." },
    },
    api_content: apiContent,
    description: apiContent.description,
    shortSummary: apiContent.shortSummary,
    highlights: apiContent.highlights,
    travelerTips: apiContent.travelerTips,
    recommendedFor: apiContent.recommendedFor,
    cautions: apiContent.cautions,
    content_version: "place-ai-v1",
    message: "AI 생성 요청 구조를 준비했습니다.",
  };
}

export function toPlaceAiGenerationApiContent(content: PlaceAiGeneratedContent): PlaceAiGenerationApiContent {
  return {
    description: {
      ko: content.description_ko,
      zh: content.description_zh,
      en: content.description_en,
      ja: content.description_ja,
    },
    travelTip: {
      ko: content.travel_tip_ko,
      zh: content.travel_tip_zh,
      en: content.travel_tip_en,
      ja: content.travel_tip_ja,
    },
    shortSummary: {
      ko: content.short_summary_ko || content.short_summary,
      zh: content.short_summary_zh || content.short_summary,
      en: content.short_summary_en || content.short_summary,
      ja: content.short_summary_ja || content.short_summary,
    },
    highlights: content.highlights,
    travelerTips: content.traveler_tips,
    recommendedFor: content.recommended_for,
    cautions: content.cautions,
  };
}

function booleanToTristate(value: boolean | undefined): PlaceFactTristate {
  if (value === true) {
    return "yes";
  }

  if (value === false) {
    return "no";
  }

  return "unknown";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 800) : "";
}

function normalizeTextArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(normalizeText)
        .filter(Boolean)
        .slice(0, 8)
    : [];
}
