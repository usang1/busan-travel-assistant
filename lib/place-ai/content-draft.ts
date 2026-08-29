import type { PlaceAiGeneratedContent, PlaceAiGenerationRequest, PlaceAiGenerationResponse, PlaceSourceData } from "@/types/place-ai";
import type { PlaceFactTristate, PlacePayload } from "@/types/database";

const emptyContent: PlaceAiGeneratedContent = {
  description_ko: "",
  description_zh: "",
  description_en: "",
  description_ja: "",
  short_summary: "",
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
    content.short_summary,
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
    short_summary: normalizeText(content.short_summary),
    highlights: normalizeTextArray(content.highlights),
    traveler_tips: normalizeTextArray(content.traveler_tips),
    recommended_for: normalizeTextArray(content.recommended_for),
    cautions: normalizeTextArray(content.cautions),
  };
}

export function buildPlaceSourceData(payload: PlacePayload): PlaceSourceData {
  const chinaInfo = payload.china_info ?? null;

  return {
    name: payload.name_ko || payload.name_zh,
    category: payload.category,
    address: payload.address_ko || payload.address_zh || payload.address || "",
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
    source: payload.source?.source_url ? "map_link" : "admin_form",
  };
}

export function buildPreparedAiGenerationResponse(request: PlaceAiGenerationRequest): PlaceAiGenerationResponse {
  return {
    status: "not_implemented",
    source_data: request.source_data,
    generated_content: normalizePlaceAiGeneratedContent(request.existing_content),
    message: "AI 생성 기반은 준비되어 있지만 이번 단계에서는 외부 AI API를 호출하지 않습니다.",
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
