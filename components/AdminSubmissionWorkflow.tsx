"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Languages, Plus, RefreshCw, Send, Sparkles, XCircle } from "lucide-react";
import { AdminAiDraftPanel } from "@/components/AdminAiDraftPanel";
import type { AdminAiDraftApplyField } from "@/components/AdminAiDraftPanel";
import { buildAdminPlaceVisibilityNotice } from "@/lib/admin-place-visibility";
import { buildPlaceSourcePayload, enrichPlaceForm, formatProviderAmenities, hasValidFormCoordinates } from "@/lib/admin-place-enrichment";
import { analyzeMapLink } from "@/lib/map-link-analysis";
import { buildHomeIntentTags, getHomeIntentKeysFromTags, homeIntentTagOptions, isHomeIntentTagSlug, type HomeIntentKey } from "@/lib/home-intent-tags";
import { normalizeLatitude, normalizeLongitude, parseMapUrl } from "@/lib/map-url";
import { canUseNaverGeocoder, geocodeKoreanAddress } from "@/lib/naver-geocoder";
import { buildPlaceSourceData, hasPlaceAiGeneratedContent } from "@/lib/place-ai/content-draft";
import { analyzePlaceMapSource } from "@/lib/place-ai/map-source";
import { findPlaceDuplicateMatches } from "@/lib/place-duplicates";
import { isPublicPlace, normalizePlaceStatusForWrite, publishedPlaceStatus } from "@/lib/place-publishing";
import { validatePlacePayloadForSave } from "@/lib/place-validation";
import { getProviderUnavailableCapabilities, toSupportedProvider } from "@/lib/place-providers/capabilities";
import { formatPlaceFactSource } from "@/lib/place-draft";
import type { NormalizedPlace } from "@/lib/place-providers/types";
import { categoryLabels, placeCategories, placeWorkflowStatuses, type ChinaWaitingLevel, type PlaceCategory, type PlaceChinaInfoPayload, type PlacePayload, type PlaceSourceProvider, type PlaceSubmissionRecord, type PlaceWithRelations, type PlaceWorkflowStatus, type SubmissionStatus } from "@/types/database";
import type { AdminTranslationFields, PlaceAiGeneratedContent, PlaceAiGenerationResponse, PlaceContentLocale } from "@/types/place-ai";

type AdminSubmissionWorkflowProps = {
  accessToken: string;
  places: PlaceWithRelations[];
  onPlaceCreated: () => Promise<void>;
};

type TranslationDraft = {
  name: string;
  description: string;
  travel_tip: string;
  address: string;
};

type PayloadTranslation = NonNullable<PlacePayload["translations"]>[number];

type PublishMenuDraft = {
  name_ko: string;
  price: number | null;
  is_recommended: boolean;
};

type PublishForm = {
  source_url: string;
  provider: PlaceSourceProvider;
  source_external_id: string;
  slug: string;
  category: PlaceCategory | "";
  name_zh: string;
  name_en: string;
  name_ja: string;
  name_ko: string;
  description_zh: string;
  description_en: string;
  description_ja: string;
  description_ko: string;
  address_ko: string;
  address_zh: string;
  address_en: string;
  address_ja: string;
  admin_summary: string;
  latitude: string;
  longitude: string;
  phone: string;
  website: string;
  opening_hours: string;
  price_level: string;
  price_min: string;
  price_max: string;
  menu_items: PublishMenuDraft[];
  waiting_level: ChinaWaitingLevel;
  waiting_minutes_min: string;
  waiting_minutes_max: string;
  recommended_order_zh: string;
  recommended_order_ko: string;
  tips_zh: string;
  tips_en: string;
  tips_ja: string;
  tips_ko: string;
  thumbnail_url: string;
  provider_image_preview_url: string;
  provider_image_attribution: string;
  provider_rating: string;
  provider_review_count: string;
  provider_amenities: string;
  source_metadata: Record<string, unknown> | null;
  source_fetched_at: string;
  status: PlaceWorkflowStatus;
  closed_days: string;
  last_verified_at: string;
  nearest_station: string;
  nearest_exit: string;
  walking_minutes: string;
  solo_friendly: boolean;
  luggage_friendly: boolean;
  chinese_menu: boolean;
  card_payment: boolean;
  is_active: boolean;
  tags_text: string;
  home_intent_keys: HomeIntentKey[];
};

const statuses: SubmissionStatus[] = ["pending", "reviewing", "approved", "rejected", "duplicate"];
const workflowStatusLabels: Record<PlaceWorkflowStatus, string> = {
  DRAFT: "초안",
  REVIEW: "검수 대기",
  PUBLISHED: "공개",
  ARCHIVED: "보관",
};
const statusLabels: Record<SubmissionStatus, string> = {
  pending: "대기",
  reviewing: "검토중",
  approved: "승인",
  rejected: "거절",
  duplicate: "중복",
};
const mapProviderLabels: Record<PlaceSourceProvider, string> = {
  NAVER: "네이버지도 링크",
  KAKAO: "카카오맵 링크",
  GOOGLE: "Google Maps 링크",
  MANUAL: "수동 입력",
};

const waitingOptions: Array<{ value: ChinaWaitingLevel; label: string; min: string; max: string }> = [
  { value: "none", label: "거의 없음", min: "0", max: "0" },
  { value: "short", label: "5~10분", min: "5", max: "10" },
  { value: "moderate", label: "10~20분", min: "10", max: "20" },
  { value: "long", label: "20~40분", min: "20", max: "40" },
  { value: "extreme", label: "40분 이상", min: "40", max: "" },
  { value: "varies", label: "시간대에 따라 다름", min: "", max: "" },
  { value: "unknown", label: "확인 필요", min: "", max: "" },
];

const foodCategories: PlaceCategory[] = ["restaurant", "cafe", "bar"];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function nullableNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function nullableInteger(value: string) {
  const number = nullableNumber(value);
  return number === null ? null : Math.max(0, Math.round(number));
}

function unifiedPlaceName(form: Pick<PublishForm, "name_ko" | "name_zh" | "name_en" | "name_ja">) {
  return form.name_ko.trim() || form.name_zh.trim() || form.name_en.trim() || form.name_ja.trim();
}

function withUnifiedPlaceName(form: PublishForm, name: string): PublishForm {
  return {
    ...form,
    name_ko: name,
    name_zh: name,
    name_en: name,
    name_ja: name,
  };
}

function parseTagsText(tagsText: string, category: PlaceCategory) {
  const customTags = tagsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first = "", second = "", third = ""] = line.split("|").map((part) => part.trim());
      const label = second || first;
      const slug = third || slugify(label || first);

      return {
        label_zh: first,
        label_ko: label,
        slug,
      };
    })
    .filter((tag) => tag.label_zh && tag.label_ko && tag.slug);

  return [
    { label_zh: categoryLabels[category].zh, label_ko: categoryLabels[category].ko, slug: category },
    ...customTags.filter((tag) => tag.slug !== category),
  ];
}

function isFoodPlaceCategory(category: PlaceCategory | "") {
  return foodCategories.includes(category as PlaceCategory);
}

function createPrimaryMenuDraft(): PublishMenuDraft {
  return {
    name_ko: "",
    price: null,
    is_recommended: true,
  };
}

function getPrimaryMenuDraft(form: Pick<PublishForm, "menu_items">) {
  return form.menu_items.find((item) => item.is_recommended) ?? form.menu_items[0] ?? createPrimaryMenuDraft();
}

function mergePublishMenuDrafts(current: PublishMenuDraft[], incoming: PublishMenuDraft[]) {
  const merged = current.filter((item) => item.name_ko.trim() || item.price !== null);

  for (const item of incoming) {
    const existingIndex = merged.findIndex((candidate) => candidate.name_ko.trim().toLowerCase() === item.name_ko.trim().toLowerCase());

    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        price: existing.price ?? item.price,
        is_recommended: existing.is_recommended || item.is_recommended,
      };
    } else {
      merged.push(item);
    }
  }

  return merged;
}

function upsertPrimaryMenuDraft(items: PublishMenuDraft[], patch: Partial<PublishMenuDraft>) {
  const primaryIndex = items.findIndex((item) => item.is_recommended);
  const targetIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const nextItem = {
    ...(items[targetIndex] ?? createPrimaryMenuDraft()),
    ...patch,
    is_recommended: true,
  };

  if (!items.length) {
    return [nextItem];
  }

  return items.map((item, index) => (index === targetIndex ? nextItem : item));
}

function hasCoordinateInput(form: Pick<PublishForm, "latitude" | "longitude">) {
  return hasValidFormCoordinates(form);
}

function geocodeQueriesFromPublishForm(form: Pick<PublishForm, "address_ko" | "address_zh" | "name_ko" | "name_zh">) {
  return Array.from(
    new Set([form.address_ko, form.name_ko, form.address_zh, form.name_zh].map((value) => value.trim()).filter(Boolean)),
  );
}

function geocodeQueryFromPublishForm(form: Pick<PublishForm, "address_ko" | "address_zh" | "name_ko" | "name_zh">) {
  return geocodeQueriesFromPublishForm(form)[0] ?? "";
}

function fillCoordinatesFromMapLink<Form extends Pick<PublishForm, "source_url" | "latitude" | "longitude">>(form: Form): Form {
  if (hasCoordinateInput(form) || !form.source_url.trim()) {
    return form;
  }

  const analysis = analyzeMapLink(form.source_url);

  if (typeof analysis.latitude !== "number" || typeof analysis.longitude !== "number") {
    return form;
  }

  return {
    ...form,
    latitude: analysis.latitude.toFixed(7),
    longitude: analysis.longitude.toFixed(7),
  };
}

function getMapLinkState(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      provider: "MANUAL" as PlaceSourceProvider,
      normalizedUrl: "",
      label: "지도 링크 없음",
      valid: true,
      message: "",
    };
  }

  const parsed = parseMapUrl(trimmed);

  if (parsed.provider === "unknown") {
    return {
      provider: "MANUAL" as PlaceSourceProvider,
      normalizedUrl: parsed.normalizedUrl,
      label: parsed.failureReason === "invalid_url" ? "올바르지 않은 링크" : "지원하지 않는 링크",
      valid: false,
      message: parsed.failureReason === "invalid_url"
        ? "올바른 지도 링크를 입력해 주세요."
        : "네이버지도, 카카오맵, Google Maps 링크만 지원합니다.",
    };
  }

  return {
    provider: parsed.sourceProvider,
    normalizedUrl: parsed.normalizedUrl,
    label: mapProviderLabels[parsed.sourceProvider],
    valid: true,
    message: "",
  };
}

function hasEnoughAiSourceFacts(form: PublishForm) {
  const hasPlaceName = Boolean(unifiedPlaceName(form));
  const hasFact = Boolean(
    form.source_url.trim() ||
      form.address_ko.trim() ||
      form.address_zh.trim() ||
      form.nearest_station.trim() ||
      form.opening_hours.trim() ||
      form.price_level.trim() ||
      form.price_min.trim() ||
      form.price_max.trim(),
  );

  return hasPlaceName && hasFact;
}

function emptyForm(submission?: PlaceSubmissionRecord | null): PublishForm {
  const parsed = parseMapUrl(submission?.source_url ?? "");
  const baseName = submission?.name ?? "";

  return {
    source_url: parsed.normalizedUrl,
    provider: parsed.sourceProvider,
    source_external_id: "",
    slug: slugify(baseName),
    category: submission?.category ?? "",
    name_zh: baseName,
    name_en: baseName,
    name_ja: baseName,
    name_ko: baseName,
    description_zh: "",
    description_en: "",
    description_ja: "",
    description_ko: "",
    address_ko: submission?.location_text ?? submission?.address_text ?? "",
    address_zh: "",
    address_en: "",
    address_ja: "",
    admin_summary: "",
    latitude: "",
    longitude: "",
    phone: "",
    website: "",
    opening_hours: "",
    price_level: "",
    price_min: "",
    price_max: "",
    menu_items: [],
    waiting_level: "unknown",
    waiting_minutes_min: "",
    waiting_minutes_max: "",
    recommended_order_zh: "",
    recommended_order_ko: "",
    tips_zh: "",
    tips_en: "",
    tips_ja: "",
    tips_ko: "",
    thumbnail_url: "",
    provider_image_preview_url: "",
    provider_image_attribution: "",
    provider_rating: "",
    provider_review_count: "",
    provider_amenities: "",
    source_metadata: null,
    source_fetched_at: "",
    status: "PUBLISHED",
    closed_days: "",
    last_verified_at: "",
    nearest_station: "",
    nearest_exit: "",
    walking_minutes: "",
    solo_friendly: false,
    luggage_friendly: false,
    chinese_menu: false,
    card_payment: false,
    is_active: true,
    tags_text: "",
    home_intent_keys: [],
  };
}

function getPrimarySource(place: PlaceWithRelations) {
  return [...(place.sources ?? [])].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0] ?? null;
}

function metadataNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function formFromPlace(place: PlaceWithRelations, submission?: PlaceSubmissionRecord): PublishForm {
  const zh = place.translations?.find((translation) => translation.locale === "zh");
  const en = place.translations?.find((translation) => translation.locale === "en");
  const ja = place.translations?.find((translation) => translation.locale === "ja");
  const ko = place.translations?.find((translation) => translation.locale === "ko");
  const source = getPrimarySource(place);
  const sourceMetadata = source?.raw_metadata ?? null;
  const chinaInfo = place.china_info;
  const unifiedName = place.name_ko || ko?.name || place.name_zh || zh?.name || en?.name || ja?.name || "";

  return {
    source_url: source?.source_url ?? submission?.source_url ?? "",
    provider: source?.provider ?? submission?.provider ?? "MANUAL",
    source_external_id: source?.external_id ?? submission?.external_id ?? "",
    slug: place.slug,
    category: place.category,
    name_zh: unifiedName,
    name_en: unifiedName,
    name_ja: unifiedName,
    name_ko: unifiedName,
    description_zh: place.short_description_zh || zh?.description || "",
    description_en: en?.description ?? "",
    description_ja: ja?.description ?? "",
    description_ko: place.short_description_ko || ko?.description || "",
    address_ko: place.address_ko || ko?.address || place.address || "",
    address_zh: place.address_zh || zh?.address || "",
    address_en: en?.address ?? "",
    address_ja: ja?.address ?? "",
    admin_summary: place.admin_summary ?? "",
    latitude: place.latitude?.toString() ?? "",
    longitude: place.longitude?.toString() ?? "",
    phone: place.phone ?? "",
    website: place.website ?? "",
    opening_hours: place.opening_hours,
    price_level: place.price_level?.toString() ?? "",
    price_min: place.price_min?.toString() ?? "",
    price_max: place.price_max?.toString() ?? "",
    menu_items: place.menu_items.map((item) => ({
      name_ko: item.name_ko || item.name_zh,
      price: item.price,
      is_recommended: item.is_recommended,
    })),
    waiting_level: chinaInfo?.waiting_level ?? "unknown",
    waiting_minutes_min: chinaInfo?.waiting_minutes_min?.toString() ?? "",
    waiting_minutes_max: chinaInfo?.waiting_minutes_max?.toString() ?? "",
    recommended_order_zh: place.recommended_order_zh,
    recommended_order_ko: place.recommended_order_ko,
    tips_zh: place.tips_zh || zh?.travel_tip || "",
    tips_en: en?.travel_tip ?? "",
    tips_ja: ja?.travel_tip ?? "",
    tips_ko: place.tips_ko || ko?.travel_tip || "",
    thumbnail_url: place.thumbnail_url,
    provider_image_preview_url: "",
    provider_image_attribution: "",
    provider_rating: metadataNumber(sourceMetadata, "rating"),
    provider_review_count: metadataNumber(sourceMetadata, "review_count"),
    provider_amenities: formatProviderAmenities(sourceMetadata?.amenities),
    source_metadata: sourceMetadata,
    source_fetched_at: source?.last_synced_at ?? "",
    status: normalizePlaceStatusForWrite(place),
    closed_days: place.closed_days ?? "",
    last_verified_at: (place.last_verified_at ?? chinaInfo?.verified_at ?? "").slice(0, 10),
    nearest_station: place.nearest_station,
    nearest_exit: place.nearest_exit,
    walking_minutes: place.walking_minutes.toString(),
    solo_friendly: place.solo_friendly || chinaInfo?.solo_friendly === "yes",
    luggage_friendly: place.luggage_friendly || chinaInfo?.luggage_friendly === "yes",
    chinese_menu: place.chinese_menu || chinaInfo?.chinese_menu === "yes",
    card_payment: place.card_payment || chinaInfo?.foreign_card === "yes",
    is_active: isPublicPlace(place),
    tags_text: place.tags
      .filter((tag) => !isHomeIntentTagSlug(tag.slug))
      .map((tag) => `${tag.label_zh} | ${tag.label_ko} | ${tag.slug}`)
      .join("\n"),
    home_intent_keys: getHomeIntentKeysFromTags(place.tags),
  };
}

function findSubmissionPlace(submission: PlaceSubmissionRecord, places: PlaceWithRelations[]) {
  if (submission.place_id) {
    const linkedPlace = places.find((place) => place.id === submission.place_id);
    if (linkedPlace) return linkedPlace;
  }

  const submittedExternalId = submission.external_id?.trim();
  const submittedUrl = parseMapUrl(submission.source_url ?? "").normalizedUrl;
  const sourceMatch = places.find((place) => (place.sources ?? []).some((source) => {
    if (source.provider !== submission.provider) return false;
    if (submittedExternalId && source.external_id === submittedExternalId) return true;
    return Boolean(submittedUrl && parseMapUrl(source.source_url ?? "").normalizedUrl === submittedUrl);
  }));
  if (sourceMatch) return sourceMatch;

  const submittedName = submission.name?.trim();
  if (!submittedName) return null;
  const nameMatches = places.filter((place) => place.name_ko.trim() === submittedName || place.name_zh.trim() === submittedName);
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

function buildPayload(form: PublishForm): PlacePayload {
  const category = form.category as PlaceCategory;
  const name = unifiedPlaceName(form);
  const chinaInfo: PlaceChinaInfoPayload = {
    chinese_taste_score: null,
    spicy_level: null,
    greasy_level: null,
    smell_level: null,
    portion_level: null,
    ordering_difficulty: null,
    waiting_level: form.waiting_level,
    waiting_minutes_min: nullableInteger(form.waiting_minutes_min),
    waiting_minutes_max: nullableInteger(form.waiting_minutes_max),
    chinese_menu: form.chinese_menu ? "yes" : "no",
    chinese_service: "unknown",
    foreign_card: form.card_payment ? "yes" : "no",
    alipay: "unknown",
    wechat_pay: "unknown",
    solo_friendly: form.solo_friendly ? "yes" : "no",
    luggage_friendly: form.luggage_friendly ? "yes" : "no",
    toilet_available: "unknown",
    reservation_required: "unknown",
    minimum_order_people: null,
    minimum_order_policy: "unknown",
    minimum_order_note: null,
    xiaohongshu_popular: "unknown",
    photo_recommended: "unknown",
    tourism_recommended: "unknown",
    subway_walk_minutes: null,
    manual_summary_override: null,
    manual_warning_override: null,
    traveler_insights: {
      solo_dining: form.solo_friendly ? "yes" : "no",
      card_payment: form.card_payment ? "yes" : "no",
      chinese_menu: form.chinese_menu ? "yes" : "no",
      luggage_storage: form.luggage_friendly ? "yes" : "no",
      waiting: form.waiting_level === "none" ? "none" : form.waiting_level === "unknown" ? "unknown" : form.waiting_level === "short" ? "some" : "high",
    },
    verification_status: "unverified",
    verified_at: form.last_verified_at || null,
  };
  const zh: TranslationDraft = {
    name,
    description: form.description_zh,
    travel_tip: form.tips_zh,
    address: form.address_zh,
  };
  const ko: TranslationDraft = {
    name,
    description: form.description_ko,
    travel_tip: form.tips_ko,
    address: form.address_ko,
  };

  return {
    slug: form.slug || slugify(name),
    name_zh: name,
    name_ko: name,
    category,
    address: form.address_ko,
    phone: form.phone || null,
    website: form.website || null,
    price_level: nullableNumber(form.price_level),
    status: form.status,
    short_description_zh: form.description_zh,
    short_description_ko: form.description_ko,
    admin_summary: form.admin_summary,
    address_ko: form.address_ko,
    address_zh: form.address_zh,
    latitude: normalizeLatitude(form.latitude),
    longitude: normalizeLongitude(form.longitude),
    closed_days: form.closed_days.trim(),
    last_verified_at: form.last_verified_at || null,
    nearest_station: form.nearest_station,
    nearest_exit: form.nearest_exit,
    walking_minutes: Number(form.walking_minutes) || 0,
    price_min: nullableNumber(form.price_min),
    price_max: nullableNumber(form.price_max),
    opening_hours: form.opening_hours,
    waiting_info_zh: "",
    waiting_info_ko: "",
    solo_friendly: form.solo_friendly,
    luggage_friendly: form.luggage_friendly,
    chinese_menu: form.chinese_menu,
    card_payment: form.card_payment,
    recommended_order_zh: form.recommended_order_zh,
    recommended_order_ko: form.recommended_order_ko,
    tips_zh: form.tips_zh,
    tips_ko: form.tips_ko,
    thumbnail_url: form.thumbnail_url.trim(),
    is_featured: false,
    is_active: form.status === publishedPlaceStatus,
    tags: [...parseTagsText(form.tags_text, category), ...buildHomeIntentTags(form.home_intent_keys)],
    menu_items: form.menu_items.map((item, index) => ({
      name_ko: item.name_ko,
      name_zh: item.name_ko,
      description_zh: "",
      price: item.price,
      is_recommended: item.is_recommended,
      sort_order: index + 1,
    })),
    translations: [
      { locale: "zh", ...zh },
      form.name_en || form.description_en || form.tips_en || form.address_en
        ? { locale: "en" as const, name, description: form.description_en, travel_tip: form.tips_en, address: form.address_en }
        : null,
      form.name_ja || form.description_ja || form.tips_ja || form.address_ja
        ? { locale: "ja" as const, name, description: form.description_ja, travel_tip: form.tips_ja, address: form.address_ja }
        : null,
      { locale: "ko", ...ko },
    ].filter((translation): translation is PayloadTranslation => Boolean(translation)),
    source: buildPlaceSourcePayload(form),
    china_info: chinaInfo,
  };
}

function applyProviderFactsToPublishForm(form: PublishForm, place: NormalizedPlace): PublishForm {
  const enriched = enrichPlaceForm(form, place);
  const incomingMenu = (place.menu ?? []).map((item) => ({
    name_ko: item.name,
    price: item.price ?? null,
    is_recommended: item.role === "signature" || item.role === "popular",
  }));
  return withUnifiedPlaceName({
    ...enriched,
    menu_items: mergePublishMenuDrafts(form.menu_items, incomingMenu),
    recommended_order_ko: form.recommended_order_ko || place.recommendedOrder?.join(" · ") || "",
  }, unifiedPlaceName(enriched) || place.name || "");
}

function buildTranslationFieldsFromPublishForm(form: PublishForm): AdminTranslationFields {
  const name = unifiedPlaceName(form);

  return {
    name_ko: name,
    name_zh: name,
    name_en: name,
    name_ja: name,
    short_description_ko: form.description_ko,
    short_description_zh: form.description_zh,
    short_description_en: form.description_en,
    short_description_ja: form.description_ja,
    description_ko: form.description_ko,
    description_zh: form.description_zh,
    description_en: form.description_en,
    description_ja: form.description_ja,
    tips_ko: form.tips_ko,
    tips_zh: form.tips_zh,
    tips_en: form.tips_en,
    tips_ja: form.tips_ja,
    recommended_order_ko: form.recommended_order_ko,
    recommended_order_zh: form.recommended_order_zh,
    address_ko: form.address_ko,
    address_zh: form.address_zh,
    address_en: form.address_en,
    address_ja: form.address_ja,
  };
}

function applyTranslationsToPublishForm(form: PublishForm, translations: Partial<AdminTranslationFields>) {
  let filledCount = 0;
  const name = unifiedPlaceName(form) || translations.name_ko?.trim() || translations.name_zh?.trim() || translations.name_en?.trim() || translations.name_ja?.trim() || "";
  const fill = (current: string, translated?: string) => {
    if (current.trim() || !translated?.trim()) {
      return current;
    }

    filledCount += 1;
    return translated.trim();
  };
  const nextForm: PublishForm = {
    ...form,
    name_ko: name,
    name_zh: name,
    name_en: name,
    name_ja: name,
    description_ko: fill(form.description_ko, translations.description_ko || translations.short_description_ko),
    description_zh: fill(form.description_zh, translations.description_zh || translations.short_description_zh),
    description_en: fill(form.description_en, translations.description_en || translations.short_description_en),
    description_ja: fill(form.description_ja, translations.description_ja || translations.short_description_ja),
    tips_ko: fill(form.tips_ko, translations.tips_ko),
    tips_zh: fill(form.tips_zh, translations.tips_zh),
    tips_en: fill(form.tips_en, translations.tips_en),
    tips_ja: fill(form.tips_ja, translations.tips_ja),
    recommended_order_ko: fill(form.recommended_order_ko, translations.recommended_order_ko),
    recommended_order_zh: fill(form.recommended_order_zh, translations.recommended_order_zh),
    address_ko: fill(form.address_ko, translations.address_ko),
    address_zh: fill(form.address_zh, translations.address_zh),
    address_en: fill(form.address_en, translations.address_en),
    address_ja: fill(form.address_ja, translations.address_ja),
  };

  return { nextForm, filledCount };
}

function needsAutoTranslation(form: PublishForm) {
  return Boolean(
    (form.description_ko.trim() && (!form.description_zh.trim() || !form.description_en.trim() || !form.description_ja.trim())) ||
      (form.tips_ko.trim() && (!form.tips_zh.trim() || !form.tips_en.trim() || !form.tips_ja.trim())) ||
      (form.address_ko.trim() && (!form.address_zh.trim() || !form.address_en.trim() || !form.address_ja.trim())) ||
      (form.recommended_order_ko.trim() && !form.recommended_order_zh.trim()),
  );
}

function applyGeneratedContentToPublishForm(form: PublishForm, content: PlaceAiGeneratedContent, fields: AdminAiDraftApplyField[]): PublishForm {
  const selected = new Set(fields);
  return {
    ...form,
    description_ko: selected.has("description_ko") ? content.description_ko : form.description_ko,
    description_zh: selected.has("description_zh") ? content.description_zh : form.description_zh,
    description_en: selected.has("description_en") ? content.description_en : form.description_en,
    description_ja: selected.has("description_ja") ? content.description_ja : form.description_ja,
    tips_ko: selected.has("travel_tip_ko") ? content.travel_tip_ko : form.tips_ko,
    tips_zh: selected.has("travel_tip_zh") ? content.travel_tip_zh : form.tips_zh,
    tips_en: selected.has("travel_tip_en") ? content.travel_tip_en : form.tips_en,
    tips_ja: selected.has("travel_tip_ja") ? content.travel_tip_ja : form.tips_ja,
  };
}

function applyGeneratedContentToEmptyPublishFields(form: PublishForm, response: PlaceAiGenerationResponse): PublishForm {
  const content = response.generated_content;
  const canUse = (locale: PlaceContentLocale, field: "description" | "travel_tip") =>
    !response.locale_results[locale].failed_fields.includes(field);
  const fill = (current: string, generated: string, locale: PlaceContentLocale, field: "description" | "travel_tip") =>
    current.trim() || !canUse(locale, field) ? current : generated;

  return {
    ...form,
    description_ko: fill(form.description_ko, content.description_ko, "ko", "description"),
    description_zh: fill(form.description_zh, content.description_zh, "zh", "description"),
    description_en: fill(form.description_en, content.description_en, "en", "description"),
    description_ja: fill(form.description_ja, content.description_ja, "ja", "description"),
    tips_ko: fill(form.tips_ko, content.travel_tip_ko, "ko", "travel_tip"),
    tips_zh: fill(form.tips_zh, content.travel_tip_zh, "zh", "travel_tip"),
    tips_en: fill(form.tips_en, content.travel_tip_en, "en", "travel_tip"),
    tips_ja: fill(form.tips_ja, content.travel_tip_ja, "ja", "travel_tip"),
  };
}

function buildPublishAiFingerprint(form: PublishForm) {
  return JSON.stringify({
    source_url: form.source_url,
    source_external_id: form.source_external_id,
    name_ko: form.name_ko,
    category: form.category,
    address_ko: form.address_ko,
    latitude: form.latitude,
    longitude: form.longitude,
    opening_hours: form.opening_hours,
    price_level: form.price_level,
    price_min: form.price_min,
    price_max: form.price_max,
    menu_items: form.menu_items,
    recommended_order_ko: form.recommended_order_ko,
    nearest_station: form.nearest_station,
    source_metadata: form.source_metadata,
  });
}

function providerDisplayName(provider: PlaceSourceProvider) {
  if (provider === "GOOGLE") return "Google Maps";
  if (provider === "NAVER") return "네이버지도";
  if (provider === "KAKAO") return "카카오맵";
  return "지도";
}

function normalizedPublishFormForAdminSummary(form: PublishForm): NormalizedPlace | null {
  const provider = form.provider === "GOOGLE"
    ? "google"
    : form.provider === "NAVER"
      ? "naver"
      : form.provider === "KAKAO"
        ? "kakao"
        : null;
  if (!provider || !form.name_ko.trim()) return null;

  const coordinates = hasValidFormCoordinates(form)
    ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
    : {};
  const types = Array.isArray(form.source_metadata?.types)
    ? form.source_metadata.types.filter((value): value is string => typeof value === "string")
    : undefined;
  const priceMin = nullableNumber(form.price_min) ?? undefined;
  const priceMax = nullableNumber(form.price_max) ?? undefined;
  const menu = readNormalizedMenu(form.source_metadata) ?? form.menu_items.map((item) => ({
    name: item.name_ko,
    price: item.price ?? undefined,
    role: item.is_recommended ? "signature" as const : "other" as const,
  }));
  const recommendedOrder = readStringArray(form.source_metadata?.recommended_order)
    ?? (form.recommended_order_ko.trim() ? [form.recommended_order_ko.trim()] : undefined);

  return {
    provider,
    providerPlaceId: form.source_external_id || undefined,
    sourceUrl: form.source_url,
    finalResolvedUrl: typeof form.source_metadata?.final_resolved_url === "string" ? form.source_metadata.final_resolved_url : undefined,
    name: form.name_ko,
    category: typeof form.source_metadata?.category === "string" ? form.source_metadata.category : form.category,
    types,
    description: typeof form.source_metadata?.provider_description === "string" ? form.source_metadata.provider_description : undefined,
    addressKo: form.address_ko || undefined,
    ...coordinates,
    website: form.website || undefined,
    openingHours: form.opening_hours ? form.opening_hours.split("\n").filter(Boolean) : undefined,
    rating: nullableNumber(form.provider_rating) ?? undefined,
    reviewCount: nullableNumber(form.provider_review_count) ?? undefined,
    priceLevel: nullableNumber(form.price_level) ?? undefined,
    priceMin,
    priceMax,
    priceRange: priceMin !== undefined || priceMax !== undefined ? { min: priceMin, max: priceMax, currency: "KRW" } : undefined,
    menu: menu.length ? menu : undefined,
    recommendedOrder,
    fetchedAt: form.source_fetched_at || undefined,
  };
}

export function AdminSubmissionWorkflow({ accessToken, places, onPlaceCreated }: AdminSubmissionWorkflowProps) {
  const [submissions, setSubmissions] = useState<PlaceSubmissionRecord[]>([]);
  const [activeStatus, setActiveStatus] = useState<SubmissionStatus>("pending");
  const [selected, setSelected] = useState<PlaceSubmissionRecord | null>(null);
  const [form, setForm] = useState<PublishForm>(() => emptyForm(null));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [webSearching, setWebSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [generatingAiDraft, setGeneratingAiDraft] = useState(false);
  const [generatingAdminSummary, setGeneratingAdminSummary] = useState(false);
  const [aiDraft, setAiDraft] = useState<PlaceAiGenerationResponse | null>(null);
  const [lastAiFingerprint, setLastAiFingerprint] = useState("");
  const [lastNormalizedPlace, setLastNormalizedPlace] = useState<NormalizedPlace | null>(null);
  const [adminSummaryFailed, setAdminSummaryFailed] = useState(false);
  const [adminSummaryErrorMessage, setAdminSummaryErrorMessage] = useState("");
  const [providerLookupNotice, setProviderLookupNotice] = useState("");

  const visibleSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === activeStatus),
    [activeStatus, submissions],
  );
  const selectedSourceLink = useMemo(() => {
    if (!selected?.source_url) return "";
    const linkState = getMapLinkState(selected.source_url);
    return linkState.valid ? linkState.normalizedUrl : "";
  }, [selected?.source_url]);

  async function adminFetch(input: string, init: RequestInit = {}) {
    return fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async function regenerateAdminSummary(place = lastNormalizedPlace ?? normalizedPublishFormForAdminSummary(form)) {
    if (!place) {
      setStatus("AI 장소 요약을 만들려면 먼저 지도 장소 정보를 불러와 주세요.");
      return;
    }

    setGeneratingAdminSummary(true);
    setAdminSummaryFailed(false);
    setAdminSummaryErrorMessage("");
    setStatus("지도 사실정보로 AI 장소 요약을 생성하는 중입니다.");

    try {
      const response = await adminFetch("/api/admin/place-summary", {
        method: "POST",
        body: JSON.stringify({ normalizedPlace: place }),
      });
      const body = (await response.json()) as { summaryKo?: string; message?: string };
      if (!response.ok || !body.summaryKo) throw new Error(body.message ?? "AI 장소 요약 생성에 실패했습니다.");

      setForm((current) => ({ ...current, admin_summary: body.summaryKo ?? current.admin_summary }));
      setAdminSummaryErrorMessage("");
      setStatus("AI 장소 요약을 다시 생성했습니다. 저장 전에 내용을 검수해 주세요.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 장소 요약 생성에 실패했습니다.";
      setAdminSummaryFailed(true);
      setAdminSummaryErrorMessage(message);
      setStatus(`AI 장소 요약 생성 실패: ${message}`);
    } finally {
      setGeneratingAdminSummary(false);
    }
  }

  async function loadSubmissions() {
    const response = await adminFetch("/api/admin/submissions");

    if (!response.ok) {
      const body = (await response.json()) as { message?: string };
      throw new Error(body.message ?? "제보 목록을 불러오지 못했습니다.");
    }

    const body = (await response.json()) as { submissions: PlaceSubmissionRecord[] };
    setSubmissions(body.submissions);
  }

  useEffect(() => {
    void loadSubmissions().catch((error) => setStatus(error instanceof Error ? error.message : "제보 목록 오류"));
    // accessToken changes only when the admin session changes.
  }, [accessToken]);

  function selectSubmission(submission: PlaceSubmissionRecord) {
    const linkedPlace = findSubmissionPlace(submission, places);
    setSelected(submission);
    setForm(linkedPlace ? formFromPlace(linkedPlace, submission) : emptyForm(submission));
    setAiDraft(null);
    setLastNormalizedPlace(null);
    setAdminSummaryFailed(false);
    setAdminSummaryErrorMessage("");
    setProviderLookupNotice("");
    setStatus(
      linkedPlace
        ? "기존에 등록된 장소 정보를 불러왔습니다."
        : submission.status === "approved"
          ? "승인된 제보와 연결된 장소를 찾지 못했습니다. 장소 관리에서 수정해 주세요."
          : "",
    );
  }

  function startDirectCreate() {
    setSelected(null);
    setForm(emptyForm(null));
    setAiDraft(null);
    setLastNormalizedPlace(null);
    setAdminSummaryFailed(false);
    setAdminSummaryErrorMessage("");
    setProviderLookupNotice("");
    setStatus("제보 없이 직접 장소를 등록합니다. 지도 링크를 넣으면 provider만 식별합니다.");
  }

  function updateField<Key extends keyof PublishForm>(key: Key, value: PublishForm[Key]) {
    setForm((current) => {
      if (key === "name_ko" || key === "name_zh" || key === "name_en" || key === "name_ja") {
        return withUnifiedPlaceName(current, String(value));
      }

      if (key === "status") {
        const nextStatus = value as PlaceWorkflowStatus;
        return { ...current, status: nextStatus, is_active: nextStatus === publishedPlaceStatus };
      }

      if (key === "is_active") {
        const isActive = Boolean(value);
        return { ...current, is_active: isActive, status: isActive ? publishedPlaceStatus : "REVIEW" };
      }

      return { ...current, [key]: value };
    });
  }

  function updateWaiting(value: ChinaWaitingLevel) {
    const option = waitingOptions.find((item) => item.value === value);

    setForm((current) => ({
      ...current,
      waiting_level: value,
      waiting_minutes_min: option?.min ?? "",
      waiting_minutes_max: option?.max ?? "",
    }));
  }

  function updatePrimaryMenu(patch: Partial<PublishMenuDraft>) {
    setForm((current) => ({
      ...current,
      menu_items: upsertPrimaryMenuDraft(current.menu_items, patch),
    }));
  }

  async function resolveCoordinatesForPublishForm(currentForm: PublishForm) {
    const formWithMapCoordinates = fillCoordinatesFromMapLink(currentForm);

    if (hasCoordinateInput(formWithMapCoordinates) || !canUseNaverGeocoder()) {
      return formWithMapCoordinates;
    }

    for (const address of geocodeQueriesFromPublishForm(formWithMapCoordinates)) {
      try {
        const [result] = await geocodeKoreanAddress(address);

        if (result) {
          return {
            ...formWithMapCoordinates,
            latitude: result.latitude.toFixed(7),
            longitude: result.longitude.toFixed(7),
            address_ko: formWithMapCoordinates.address_ko || result.roadAddress || result.jibunAddress || result.address,
          };
        }
      } catch {
        // Try the next available address/name candidate before reporting no result.
      }
    }

    return formWithMapCoordinates;
  }

  async function fillCoordinatesFromAddress() {
    const address = geocodeQueryFromPublishForm(form);

    if (!address) {
      setStatus("좌표를 찾으려면 주소 또는 장소명을 먼저 입력해 주세요.");
      return;
    }

    if (!canUseNaverGeocoder()) {
      setStatus("네이버 지도 키가 없어 주소 자동 변환을 사용할 수 없습니다.");
      return;
    }

    setGeocoding(true);
    setStatus("네이버 지도에서 주소 좌표를 찾는 중입니다.");

    try {
      const nextForm = await resolveCoordinatesForPublishForm(form);

      if (!hasCoordinateInput(nextForm)) {
        setStatus("주소 검색 결과가 없습니다.");
        return;
      }

      setForm(nextForm);
      setStatus(`좌표를 입력했습니다: ${nextForm.latitude}, ${nextForm.longitude}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "주소 좌표 변환에 실패했습니다.");
    } finally {
      setGeocoding(false);
    }
  }

  async function prepareAiDraft(localeTargets: PlaceContentLocale[] = ["ko", "zh", "en", "ja"]) {
    if (!form.category) {
      setStatus("AI 설명을 생성하려면 카테고리를 먼저 선택해 주세요.");
      return;
    }

    const mapLinkState = getMapLinkState(form.source_url);

    if (form.source_url.trim() && !mapLinkState.valid) {
      setStatus(mapLinkState.message);
      return;
    }

    if (!hasEnoughAiSourceFacts(form)) {
      setStatus("AI 설명을 생성하려면 장소명과 최소한의 장소 정보가 필요합니다.");
      return;
    }

    const payload = buildPayload(form);
    const inputFingerprint = buildPublishAiFingerprint(form);

    if (localeTargets.length === 4 && aiDraft && lastAiFingerprint === inputFingerprint) {
      await translateTextFields();
      return;
    }

    if (!payload.name_ko) {
      setStatus("AI 설명을 생성하려면 장소명과 최소한의 장소 정보가 필요합니다.");
      return;
    }

    setGeneratingAiDraft(true);
    setStatus("여행자용 설명 생성 중...");

    const existingContent = localeTargets.length < 4 && aiDraft
      ? aiDraft.generated_content
      : {
          description_ko: form.description_ko,
          description_zh: form.description_zh,
          description_en: form.description_en,
          description_ja: form.description_ja,
          travel_tip_ko: form.tips_ko,
          travel_tip_zh: form.tips_zh,
          travel_tip_en: form.tips_en,
          travel_tip_ja: form.tips_ja,
        };

    try {
      const response = await adminFetch("/api/admin/place-ai-generation", {
        method: "POST",
        body: JSON.stringify({
          source_data: buildPlaceSourceData(payload, { formattedAddress: form.address_en }),
          locale_targets: localeTargets,
          existing_content: existingContent,
        }),
      });
      const body = (await response.json()) as PlaceAiGenerationResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in body ? body.message : "AI 설명 생성에 실패했습니다. 직접 작성하거나 다시 시도해주세요.");
      }

      const generatedResponse = body as PlaceAiGenerationResponse;
      const generatedForm = applyGeneratedContentToEmptyPublishFields(form, generatedResponse);
      let translations: Partial<AdminTranslationFields> = {};
      let translationNotice = "";

      try {
        setTranslating(true);
        const translationResponse = await adminFetch("/api/admin/translate-place", {
          method: "POST",
          body: JSON.stringify({ fields: buildTranslationFieldsFromPublishForm(generatedForm) }),
        });
        const translationBody = (await translationResponse.json()) as { translations?: Partial<AdminTranslationFields>; failed_fields?: string[]; message?: string };
        if (!translationResponse.ok) throw new Error(translationBody.message ?? "AI 이름/주소 번역에 실패했습니다.");
        translations = translationBody.translations ?? {};
        const translated = applyTranslationsToPublishForm(generatedForm, translations);
        const failed = translationBody.failed_fields?.length ? ` 검증 실패: ${translationBody.failed_fields.join(", ")}` : "";
        translationNotice = ` 이름/주소 번역 ${translated.filledCount}개를 함께 반영했습니다.${failed}`;
      } catch (translationError) {
        const message = translationError instanceof Error ? translationError.message : "AI 이름/주소 번역에 실패했습니다.";
        translationNotice = ` 설명/여행팁은 반영했지만 이름/주소 번역은 실패했습니다: ${message}`;
      } finally {
        setTranslating(false);
      }

      setAiDraft(generatedResponse);
      setLastAiFingerprint(inputFingerprint);
      setForm((current) => {
        const withContent = applyGeneratedContentToEmptyPublishFields(current, generatedResponse);
        return applyTranslationsToPublishForm(withContent, translations).nextForm;
      });
      setStatus(`${generatedResponse.message} 비어 있는 locale 필드에 결과를 반영했습니다.${translationNotice}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatus(message ? `AI 설명 생성 실패: ${message}` : "AI 설명 생성에 실패했습니다. 직접 작성하거나 다시 시도해 주세요.");
    } finally {
      setGeneratingAiDraft(false);
    }
  }

  function applyAiDraft(fields: AdminAiDraftApplyField[]) {
    if (!aiDraft || !hasPlaceAiGeneratedContent(aiDraft.generated_content)) {
      setStatus("적용할 AI 생성 결과가 없습니다.");
      return;
    }

    if (fields.length === 0) {
      setStatus("현재 폼에 적용할 AI 설명 필드를 선택해 주세요.");
      return;
    }

    const content = aiDraft.generated_content;
    setForm((current) => applyGeneratedContentToPublishForm(current, content, fields));
    setStatus(`AI 생성 결과 ${fields.length}개 필드를 입력 폼에 적용했습니다. DB 저장은 장소 등록 버튼을 눌러야 반영됩니다.`);
  }

  async function parseSourceUrl(forceWebSearch = false) {
    const parsed = parseMapUrl(form.source_url);

    if (!parsed.normalizedUrl) {
      setForm((current) => ({
        ...current,
        source_url: "",
        provider: "MANUAL",
        source_external_id: "",
      }));
      setStatus("지도 링크를 먼저 입력해 주세요.");
      return;
    }

    if (forceWebSearch) {
      setWebSearching(true);
      setStatus("Provider에 없는 제보 장소 정보를 웹검색으로 보완하는 중입니다.");
    } else {
      setAnalyzing(true);
      setStatus("지도 링크를 분석하는 중입니다.");
    }

    try {
      const response = await adminFetch("/api/admin/map-link", {
        method: "POST",
        body: JSON.stringify({
          url: parsed.normalizedUrl,
          forceWebSearch,
          searchHints: {
            name: form.name_ko,
            address: form.address_ko,
            category: form.category,
          },
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "지도 링크 분석 실패");
      }

      const body = (await response.json()) as {
        analysis: {
          provider: string;
          sourceProvider: PlaceSourceProvider;
          normalizedUrl: string;
          resolvedUrl?: string;
          title?: string;
          latitude?: number;
          longitude?: number;
          placeId?: string;
          externalId?: string;
          coordinateSource?: string;
          confidence?: string;
          failureReason?: string;
        };
        normalizedPlace?: NormalizedPlace;
        lookupError?: string;
        adminSummary?: { summaryKo?: string } | null;
        adminSummaryError?: string;
        koreanContent?: { description?: string; travelTip?: string; failedFields?: string[]; message?: string } | null;
        koreanContentError?: string;
        aiConfigured?: boolean;
        providerLookup?: { configured: boolean; enriched: boolean; message: string };
      };
      const { analysis } = body;
      const normalizedPlace = body.normalizedPlace;
      const adminSummary = body.adminSummary?.summaryKo?.trim() ?? "";
      const koreanContent = body.koreanContent;
      const title = normalizedPlace?.name?.trim() ?? analysis.title?.trim() ?? "";
      const externalId = normalizedPlace?.providerPlaceId ?? analysis.externalId ?? analysis.placeId;
      const latitude = normalizedPlace?.latitude ?? analysis.latitude;
      const longitude = normalizedPlace?.longitude ?? analysis.longitude;
      const hasResolvedCoordinates = normalizeLatitude(latitude) !== null && normalizeLongitude(longitude) !== null;
      const openingHours = Array.isArray(normalizedPlace?.openingHours)
        ? normalizedPlace.openingHours.join("\n")
        : normalizedPlace?.openingHours ?? "";

      setLastNormalizedPlace(normalizedPlace ?? null);
      setAdminSummaryFailed(Boolean(body.adminSummaryError));
      setAdminSummaryErrorMessage(body.adminSummaryError ?? "");
      setProviderLookupNotice(body.providerLookup?.message ?? "");

      setForm((current) => {
        const enriched = normalizedPlace ? applyProviderFactsToPublishForm(current, normalizedPlace) : current;
        const nextForm = {
          ...enriched,
          source_url: analysis.normalizedUrl,
          provider: analysis.sourceProvider,
          source_external_id: externalId ?? enriched.source_external_id,
          name_ko: enriched.name_ko || title,
          slug: enriched.slug || slugify(title),
          latitude: hasResolvedCoordinates && !hasCoordinateInput(enriched) ? latitude!.toFixed(7) : enriched.latitude,
          longitude: hasResolvedCoordinates && !hasCoordinateInput(enriched) ? longitude!.toFixed(7) : enriched.longitude,
          opening_hours: enriched.opening_hours || openingHours,
          admin_summary: enriched.admin_summary || adminSummary,
          description_ko: enriched.description_ko || koreanContent?.description?.trim() || "",
          tips_ko: enriched.tips_ko || koreanContent?.travelTip?.trim() || "",
        };
        return withUnifiedPlaceName(nextForm, unifiedPlaceName(nextForm) || title);
      });

      const filled = [
        title ? "장소명" : "",
        hasResolvedCoordinates ? "좌표" : "",
        externalId ? "지도 장소 ID" : "",
        normalizedPlace?.formattedAddress || normalizedPlace?.addressKo ? "주소" : "",
        normalizedPlace?.category ? "카테고리" : "",
        normalizedPlace?.openingHours || normalizedPlace?.currentOpeningHours ? "영업시간" : "",
        normalizedPlace?.phone ? "전화번호" : "",
        normalizedPlace?.website ? "웹사이트" : "",
        normalizedPlace?.photos?.length ? "사진 미리보기" : "",
        normalizedPlace?.priceLevel !== undefined ? "가격대" : "",
        normalizedPlace?.rating !== undefined ? "평점" : "",
        normalizedPlace?.reviewCount !== undefined ? "리뷰 수" : "",
        adminSummary ? "AI 장소 요약" : "",
        koreanContent?.description || koreanContent?.travelTip ? "한국어 여행자 콘텐츠" : "",
      ].filter(Boolean);
      const aiNotice = body.aiConfigured ? "" : " OpenAI API 키가 없어 AI 장소 요약은 생성하지 않았습니다.";
      const aiErrorNotice = body.adminSummaryError ? ` AI 장소 요약 생성 실패: ${body.adminSummaryError}` : "";
      const koreanContentErrorNotice = body.koreanContentError ? ` 한국어 여행자 콘텐츠 생성 실패: ${body.koreanContentError}` : "";
      const lookupNotice = body.lookupError ? ` Provider 상세 조회 실패: ${body.lookupError}` : "";
      const providerConfigurationNotice = body.providerLookup?.message ? ` ${body.providerLookup.message}` : "";
      const coordinateNotice = hasResolvedCoordinates
        ? ""
        : " 이 지도 링크에서는 좌표를 자동으로 가져오지 못했습니다. 직접 입력하거나 다른 공유 링크를 사용해주세요.";
      setStatus(
        filled.length
          ? `지도 링크 분석 완료: ${filled.join(", ")}를 채웠습니다.${coordinateNotice}${lookupNotice}${providerConfigurationNotice}${aiNotice}${aiErrorNotice}${koreanContentErrorNotice}`
          : `provider만 확인했습니다. 장소명과 좌표는 직접 입력해 주세요.${coordinateNotice}${lookupNotice}${providerConfigurationNotice}${aiNotice}${aiErrorNotice}${koreanContentErrorNotice}`,
      );
    } catch (error) {
      const localAnalysis = analyzeMapLink(parsed.normalizedUrl);
      const hasLocalCoordinates = normalizeLatitude(localAnalysis.latitude) !== null && normalizeLongitude(localAnalysis.longitude) !== null;
      setForm((current) => ({
        ...current,
        source_url: parsed.normalizedUrl,
        provider: parsed.sourceProvider,
        source_external_id: localAnalysis.externalId ?? current.source_external_id,
        latitude: hasLocalCoordinates ? localAnalysis.latitude!.toFixed(7) : current.latitude,
        longitude: hasLocalCoordinates ? localAnalysis.longitude!.toFixed(7) : current.longitude,
      }));
      setStatus(
        hasLocalCoordinates
          ? "서버 분석은 실패했지만 URL에 포함된 좌표를 입력했습니다."
          : error instanceof Error
            ? error.message
            : "이 지도 링크에서는 좌표를 자동으로 가져오지 못했습니다. 직접 입력하거나 다른 공유 링크를 사용해주세요.",
      );
    } finally {
      if (forceWebSearch) setWebSearching(false);
      else setAnalyzing(false);
    }
  }

  async function translateTextFields() {
    const fields = buildTranslationFieldsFromPublishForm(form);

    if (!Object.values(fields).some((value) => value.trim())) {
      setStatus("번역할 한국어/중국어/영어 텍스트를 먼저 입력해 주세요.");
      return;
    }

    setTranslating(true);
    setStatus("OpenAI API로 비어 있는 번역 칸을 채우는 중입니다.");

    try {
      const response = await adminFetch("/api/admin/translate-place", {
        method: "POST",
        body: JSON.stringify({ fields }),
      });
      const body = (await response.json()) as { translations?: Partial<AdminTranslationFields>; failed_fields?: string[]; message?: string };

      if (!response.ok) {
        throw new Error(body.message ?? "AI 번역에 실패했습니다.");
      }

      const { nextForm, filledCount } = applyTranslationsToPublishForm(form, body.translations ?? {});
      setForm(nextForm);
      const failureNotice = body.failed_fields?.length ? ` 검증 실패: ${body.failed_fields.join(", ")}` : "";
      setStatus(filledCount > 0 ? `AI 번역으로 빈칸 ${filledCount}개를 채웠습니다.${failureNotice}` : `이미 입력된 값은 유지했습니다. 채울 빈칸이 없습니다.${failureNotice}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI 번역 중 오류가 발생했습니다.");
    } finally {
      setTranslating(false);
    }
  }

  async function autoTranslateBeforePublish(currentForm: PublishForm) {
    if (!needsAutoTranslation(currentForm)) {
      return { nextForm: currentForm, notice: "" };
    }

    setTranslating(true);
    setStatus("한국어 입력값을 OpenAI API로 자동 번역하는 중입니다.");

    try {
      const response = await adminFetch("/api/admin/translate-place", {
        method: "POST",
        body: JSON.stringify({ fields: buildTranslationFieldsFromPublishForm(currentForm) }),
      });
      const body = (await response.json()) as { translations?: Partial<AdminTranslationFields>; failed_fields?: string[]; message?: string };

      if (!response.ok) {
        throw new Error(body.message ?? "AI 번역에 실패했습니다.");
      }

      const { nextForm, filledCount } = applyTranslationsToPublishForm(currentForm, body.translations ?? {});
      const failureNotice = body.failed_fields?.length ? ` 일부 번역 검증 필요: ${body.failed_fields.join(", ")}.` : "";
      const notice = filledCount > 0 ? ` 한국어 입력값 ${filledCount}개를 자동 번역했습니다.${failureNotice}` : failureNotice;

      setForm(nextForm);
      return { nextForm, notice };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 번역 중 오류가 발생했습니다.";
      throw new Error(`자동 번역 실패: ${message}`);
    } finally {
      setTranslating(false);
    }
  }

  async function updateSubmissionStatus(nextStatus: SubmissionStatus) {
    if (!selected) {
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const response = await adminFetch(`/api/admin/submissions/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "상태 변경 실패");
      }

      await loadSubmissions();
      setSelected((current) => (current ? { ...current, status: nextStatus } : current));
      setStatus(`${statusLabels[nextStatus]} 상태로 변경했습니다.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "상태 변경 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function publishPlace() {
    let formToPublish = form;
    let translationNotice = "";

    if (
      !(formToPublish.slug || slugify(unifiedPlaceName(formToPublish))) ||
      !unifiedPlaceName(formToPublish) ||
      !formToPublish.category
    ) {
      setStatus("장소명, 카테고리, slug는 필수입니다.");
      return;
    }

    const mapLinkState = getMapLinkState(formToPublish.source_url);
    if (formToPublish.source_url.trim() && !mapLinkState.valid) {
      setStatus(mapLinkState.message);
      return;
    }

    if (mapLinkState.normalizedUrl && formToPublish.source_url !== mapLinkState.normalizedUrl) {
      formToPublish = {
        ...formToPublish,
        source_url: mapLinkState.normalizedUrl,
        provider: mapLinkState.provider,
      };
      setForm(formToPublish);
    }

    setSaving(true);
    setStatus("");

    try {
      if (!hasCoordinateInput(formToPublish) && (formToPublish.source_url.trim() || geocodeQueryFromPublishForm(formToPublish))) {
        setGeocoding(true);
        setStatus("좌표가 비어 있어 주소로 자동 검색하는 중입니다.");

        try {
          formToPublish = await resolveCoordinatesForPublishForm(formToPublish);
          setForm(formToPublish);
        } catch (error) {
          setStatus(error instanceof Error ? `좌표 자동 변환 실패: ${error.message}` : "좌표 자동 변환에 실패했습니다.");
        } finally {
          setGeocoding(false);
        }
      }

      const translated = await autoTranslateBeforePublish(formToPublish);
      formToPublish = translated.nextForm;
      translationNotice = translated.notice;

      const payload = buildPayload(formToPublish);
      validatePlacePayloadForSave(payload);
      const placesResponse = await adminFetch("/api/admin/places");
      if (!placesResponse.ok) {
        throw new Error("중복 장소 확인을 위해 기존 장소를 불러오지 못했습니다.");
      }
      const placesBody = (await placesResponse.json()) as { places?: PlaceWithRelations[] };
      const duplicateMatches = findPlaceDuplicateMatches(payload, placesBody.places ?? []);
      const exactDuplicate = duplicateMatches.find((match) => match.level === "exact");
      const existingPlaceId = selected && exactDuplicate ? exactDuplicate.placeId : null;
      if (exactDuplicate && !existingPlaceId) {
        setStatus(`이미 등록된 provider 장소 ID입니다: ${exactDuplicate.placeName}`);
        return;
      }
      const possibleDuplicate = duplicateMatches.find((match) => match.level === "possible");
      if (possibleDuplicate) {
        const detail = possibleDuplicate.distanceMeters !== undefined ? ` (${possibleDuplicate.distanceMeters}m 이내)` : "";
        const confirmed = window.confirm(`중복 가능성이 있는 장소가 있습니다: ${possibleDuplicate.placeName}${detail}\n자동 병합하지 않습니다. 그래도 새 장소로 저장할까요?`);
        if (!confirmed) {
          setStatus("중복 가능성을 확인한 뒤 기존 장소를 수정하거나 다시 저장해 주세요.");
          return;
        }
      }
      const endpoint = selected ? `/api/admin/submissions/${selected.id}/approve` : "/api/admin/places";
      const response = await adminFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(existingPlaceId ? { payload, placeId: existingPlaceId } : payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "장소 등록 실패");
      }

      const body = (await response.json()) as { place?: PlaceWithRelations };
      await loadSubmissions();
      await onPlaceCreated();
      const visibilityNotice = body.place ? ` ${buildAdminPlaceVisibilityNotice(body.place)}` : "";
      const duplicateNotice = existingPlaceId ? ` 기존 장소(${exactDuplicate?.placeName})를 수정하고 제보를 승인했습니다.` : "";
      setStatus(selected ? `장소 등록과 제보 승인이 완료되었습니다.${translationNotice}${duplicateNotice}${visibilityNotice}` : `장소를 직접 등록했습니다.${translationNotice}${visibilityNotice}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "장소 등록 중 오류가 발생했습니다.");
    } finally {
      setGeocoding(false);
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">사용자 제보 검수</h2>
          <p className="mt-1 text-sm text-slate-500">AI 검수 없이 관리자가 직접 보완 후 장소를 등록합니다.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadSubmissions()} className="grid size-10 place-items-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200">
            <RefreshCw size={17} aria-hidden="true" />
          </button>
          <button type="button" onClick={startDirectCreate} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white">
            <Plus size={16} aria-hidden="true" />
            직접 등록
          </button>
        </div>
      </div>

      {status ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setActiveStatus(item)}
                className={[
                  "shrink-0 rounded-full px-3 py-2 text-xs font-black ring-1",
                  activeStatus === item ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200",
                ].join(" ")}
              >
                {statusLabels[item]}
              </button>
            ))}
          </div>

          <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
            {visibleSubmissions.length > 0 ? (
              visibleSubmissions.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => selectSubmission(submission)}
                  className={[
                    "block w-full rounded-[20px] p-3 text-left ring-1 transition",
                    selected?.id === submission.id ? "bg-slate-950 text-white ring-slate-950" : "bg-slate-50 text-slate-900 ring-slate-200 hover:bg-white",
                  ].join(" ")}
                >
                  <span className="block truncate text-sm font-black">{submission.name || "지도 링크 제보"}</span>
                  <span className="mt-1 block text-xs opacity-70">{submission.provider} · {new Date(submission.created_at).toLocaleDateString("ko-KR")}</span>
                  <span className="mt-2 line-clamp-2 text-xs opacity-80">{submission.recommendation_reason || submission.notes}</span>
                </button>
              ))
            ) : (
              <div className="rounded-[20px] bg-slate-50 p-4 text-sm text-slate-500 ring-1 ring-slate-200">해당 상태의 제보가 없습니다.</div>
            )}
          </div>
        </aside>

        <div className="space-y-5">
          {selected ? (
            <section className="rounded-[24px] bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{selected.name || "지도 링크 제보"}</h3>
                  <p className="mt-1 text-sm text-slate-500">제보자: {selected.user_id ?? "익명"} · {new Date(selected.created_at).toLocaleString("ko-KR")}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{statusLabels[selected.status]}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{selected.recommendation_reason || selected.notes}</p>
              {selectedSourceLink ? (
                <div className="mt-4">
                  <p className="text-xs font-black text-slate-500">제보된 지도 링크</p>
                  <a
                    href={selectedSourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex min-h-12 max-w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
                    title="제보된 지도 링크 새 탭에서 열기"
                  >
                    <span className="min-w-0 flex-1 break-all underline underline-offset-2">{selectedSourceLink}</span>
                    <ExternalLink size={16} className="shrink-0" aria-hidden="true" />
                  </a>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void updateSubmissionStatus("reviewing")} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                  검토중
                </button>
                <button type="button" onClick={() => void updateSubmissionStatus("rejected")} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                  <XCircle size={14} aria-hidden="true" />
                  거절
                </button>
                <button type="button" onClick={() => void updateSubmissionStatus("duplicate")} className="rounded-full bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                  중복
                </button>
              </div>
            </section>
          ) : null}

          <PublishFormView
            form={form}
            saving={saving}
            selected={selected}
            onFieldChange={updateField}
            onWaitingChange={updateWaiting}
            onPrimaryMenuChange={updatePrimaryMenu}
            onParseSourceUrl={() => void parseSourceUrl()}
            onWebSearch={() => void parseSourceUrl(true)}
            onPublish={() => void publishPlace()}
            analyzing={analyzing}
            webSearching={webSearching}
            geocoding={geocoding}
            translating={translating}
            aiDraft={aiDraft}
            generatingAiDraft={generatingAiDraft}
            generatingAdminSummary={generatingAdminSummary}
            adminSummaryFailed={adminSummaryFailed}
            adminSummaryErrorMessage={adminSummaryErrorMessage}
            providerLookupNotice={providerLookupNotice}
            status={status}
            onGeocode={() => void fillCoordinatesFromAddress()}
            onPrepareAiDraft={(locales) => void prepareAiDraft(locales)}
            onApplyAiDraft={applyAiDraft}
            onCancelAiDraft={() => setAiDraft(null)}
            onTranslate={() => void translateTextFields()}
            onRegenerateAdminSummary={() => void regenerateAdminSummary()}
          />
        </div>
      </div>
    </section>
  );
}

function PublishFormView({
  form,
  saving,
  selected,
  onFieldChange,
  onWaitingChange,
  onPrimaryMenuChange,
  onParseSourceUrl,
  onWebSearch,
  onPublish,
  analyzing,
  webSearching,
  geocoding,
  translating,
  aiDraft,
  generatingAiDraft,
  generatingAdminSummary,
  adminSummaryFailed,
  adminSummaryErrorMessage,
  providerLookupNotice,
  status,
  onGeocode,
  onPrepareAiDraft,
  onApplyAiDraft,
  onCancelAiDraft,
  onTranslate,
  onRegenerateAdminSummary,
}: {
  form: PublishForm;
  saving: boolean;
  selected: PlaceSubmissionRecord | null;
  onFieldChange: <Key extends keyof PublishForm>(key: Key, value: PublishForm[Key]) => void;
  onWaitingChange: (value: ChinaWaitingLevel) => void;
  onPrimaryMenuChange: (patch: Partial<PublishMenuDraft>) => void;
  onParseSourceUrl: () => void;
  onWebSearch: () => void;
  onPublish: () => void;
  analyzing: boolean;
  webSearching: boolean;
  geocoding: boolean;
  translating: boolean;
  aiDraft: PlaceAiGenerationResponse | null;
  generatingAiDraft: boolean;
  generatingAdminSummary: boolean;
  adminSummaryFailed: boolean;
  adminSummaryErrorMessage: string;
  providerLookupNotice: string;
  status: string;
  onGeocode: () => void;
  onPrepareAiDraft: (locales?: PlaceContentLocale[]) => void;
  onApplyAiDraft: (fields: AdminAiDraftApplyField[]) => void;
  onCancelAiDraft: () => void;
  onTranslate: () => void;
  onRegenerateAdminSummary: () => void;
}) {
  const [previewLocale, setPreviewLocale] = useState<PlaceContentLocale>("ko");
  const isFoodPlace = isFoodPlaceCategory(form.category);
  const primaryMenu = getPrimaryMenuDraft(form);
  const currentAiContent = useMemo(
    () => ({
      description_ko: form.description_ko,
      description_zh: form.description_zh,
      description_en: form.description_en,
      description_ja: form.description_ja,
      travel_tip_ko: form.tips_ko,
      travel_tip_zh: form.tips_zh,
      travel_tip_en: form.tips_en,
      travel_tip_ja: form.tips_ja,
    }),
    [form.description_en, form.description_ja, form.description_ko, form.description_zh, form.tips_en, form.tips_ja, form.tips_ko, form.tips_zh],
  );
  const mapLinkState = useMemo(() => getMapLinkState(form.source_url), [form.source_url]);

  function updateSourceUrl(value: string) {
    const parsed = parseMapUrl(value);
    const facts = analyzePlaceMapSource(value);

    onFieldChange("source_url", value);
    onFieldChange("provider", parsed.sourceProvider);

    if (facts.external_id) {
      onFieldChange("source_external_id", facts.external_id);
    }
  }

  function normalizeSourceUrl() {
    const nextMapLinkState = getMapLinkState(form.source_url);

    if (!nextMapLinkState.valid || !nextMapLinkState.normalizedUrl) {
      return;
    }

    onFieldChange("source_url", nextMapLinkState.normalizedUrl);
    onFieldChange("provider", nextMapLinkState.provider);
  }

  function toggleHomeIntent(key: HomeIntentKey, checked: boolean) {
    onFieldChange(
      "home_intent_keys",
      checked
        ? Array.from(new Set([...form.home_intent_keys, key]))
        : form.home_intent_keys.filter((item) => item !== key),
    );
  }

  return (
    <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{selected ? "제보 기반 최종 장소 등록" : "관리자 직접 장소 등록"}</h3>
      </div>

      <section className="mt-5 border-y border-slate-200 py-5">
        <h4 className="text-sm font-black text-slate-950">1. 지도 링크</h4>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={form.source_url}
            onChange={(event) => updateSourceUrl(event.target.value)}
            onBlur={normalizeSourceUrl}
            placeholder="Google Maps / 네이버지도 / 카카오맵 링크"
            className={`${inputClass} min-w-0`}
          />
          <button type="button" onClick={onParseSourceUrl} disabled={analyzing || webSearching || !mapLinkState.valid} className="min-h-12 w-full shrink-0 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50 sm:w-auto">
            {analyzing ? `${providerDisplayName(mapLinkState.provider)} 장소 정보를 불러오는 중...` : "장소 정보 불러오기"}
          </button>
          <button type="button" onClick={onWebSearch} disabled={analyzing || webSearching || !mapLinkState.valid || !form.source_url.trim()} className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-50 px-4 text-sm font-black text-teal-800 ring-1 ring-teal-200 disabled:opacity-50 sm:w-auto">
            <Sparkles size={16} aria-hidden="true" />
            {webSearching ? "웹검색 보완 중..." : "웹검색으로 보완"}
          </button>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">Google Maps / 네이버지도 / 카카오맵 지원</p>
        {mapLinkState.valid && mapLinkState.normalizedUrl ? (
          <a
            href={mapLinkState.normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-50 px-3 text-sm font-black text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100"
          >
            제보된 링크 열기
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        ) : null}
      </section>

      <section className="border-b border-slate-200 py-5">
        <h4 className="text-sm font-black text-slate-950">2. 관리자 기본 입력</h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="장소명"><input value={form.name_ko} onChange={(event) => onFieldChange("name_ko", event.target.value)} className={inputClass} /></Field>
          <Field label="카테고리">
            <select value={form.category} onChange={(event) => onFieldChange("category", event.target.value as PlaceCategory)} className={inputClass}>
              <option value="">선택 필요</option>
              {placeCategories.map((category) => <option key={category} value={category}>{categoryLabels[category].ko}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-bold text-slate-700">홈 카테고리</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {homeIntentTagOptions.map((option) => (
                <CheckField
                  key={option.key}
                  label={option.label_ko}
                  checked={form.home_intent_keys.includes(option.key)}
                  onChange={(checked) => toggleHomeIntent(option.key, checked)}
                />
              ))}
            </div>
          </div>
          {isFoodPlace ? (
            <>
              <Field label="대표 메뉴">
                <input
                  value={primaryMenu.name_ko}
                  onChange={(event) => onPrimaryMenuChange({ name_ko: event.target.value })}
                  className={inputClass}
                  placeholder="예: 돼지국밥"
                />
              </Field>
              <Field label="대표 메뉴 가격">
                <input
                  value={primaryMenu.price ?? ""}
                  onChange={(event) => onPrimaryMenuChange({ price: nullableNumber(event.target.value) })}
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="예: 10000"
                />
              </Field>
              <Field label="웨이팅">
                <select value={form.waiting_level} onChange={(event) => onWaitingChange(event.target.value as ChinaWaitingLevel)} className={inputClass}>
                  {waitingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="가격대">
                <select value={form.price_level} onChange={(event) => onFieldChange("price_level", event.target.value)} className={inputClass}>
                  <option value="">정보 없음</option><option value="0">무료</option><option value="1">₩</option><option value="2">₩₩</option><option value="3">₩₩₩</option><option value="4">₩₩₩₩</option>
                </select>
              </Field>
            </>
          ) : null}
          {(form.thumbnail_url.trim() || form.provider_image_preview_url.trim()) ? (
            <div className="sm:col-span-2">
              <Field label="대표 이미지">
                <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-center">
                  <div
                    className="aspect-[4/3] w-full max-w-[160px] rounded-lg bg-slate-100 bg-cover bg-center ring-1 ring-slate-200"
                    style={{ backgroundImage: `url(${form.thumbnail_url || form.provider_image_preview_url})` }}
                  />
                  <div>
                    <input value={form.thumbnail_url} onChange={(event) => onFieldChange("thumbnail_url", event.target.value)} className={inputClass} placeholder="관리자 이미지 URL" />
                    {!form.thumbnail_url && form.provider_image_preview_url ? (
                      <p className="mt-2 text-xs leading-5 text-amber-700">
                        Provider 사진 미리보기입니다. Google 정책상 임시 사진 URL은 DB 대표 이미지로 자동 저장하지 않습니다.
                        {form.provider_image_attribution ? ` 출처: ${form.provider_image_attribution}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Field>
            </div>
          ) : null}
          {!isFoodPlace ? (
            <Field label="가격대">
              <select value={form.price_level} onChange={(event) => onFieldChange("price_level", event.target.value)} className={inputClass}>
                <option value="">정보 없음</option><option value="0">무료</option><option value="1">₩</option><option value="2">₩₩</option><option value="3">₩₩₩</option><option value="4">₩₩₩₩</option>
              </select>
            </Field>
          ) : null}
          <Field label="상태">
            <select value={form.status} onChange={(event) => onFieldChange("status", event.target.value as PlaceWorkflowStatus)} className={inputClass}>
              {placeWorkflowStatuses.map((workflowStatus) => (
                <option key={workflowStatus} value={workflowStatus}>{workflowStatusLabels[workflowStatus]}</option>
              ))}
            </select>
          </Field>
          <Field label="마지막 확인일">
            <input type="date" value={form.last_verified_at} onChange={(event) => onFieldChange("last_verified_at", event.target.value)} className={inputClass} />
          </Field>
          <Field label="휴무일">
            <input value={form.closed_days} onChange={(event) => onFieldChange("closed_days", event.target.value)} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="AI 장소 요약 (관리자 내부 메모)">
              <textarea value={form.admin_summary} onChange={(event) => onFieldChange("admin_summary", event.target.value)} className={textareaClass} />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">공개 추천 설명과 분리된 내부 참고용 요약입니다. 사용자 제보 원문과 별도로 저장됩니다.</p>
                <button type="button" onClick={onRegenerateAdminSummary} disabled={generatingAdminSummary} className="min-h-11 shrink-0 rounded-lg bg-white px-3 text-xs font-black text-teal-800 ring-1 ring-teal-200 disabled:opacity-50">
                  {generatingAdminSummary ? "AI 요약 생성 중..." : "AI 요약 다시 생성"}
                </button>
              </div>
              {adminSummaryFailed ? <p className="mt-2 text-xs font-bold leading-5 text-rose-700">AI 장소 요약 생성 실패: {adminSummaryErrorMessage || "다시 생성해 주세요."} Provider 사실정보는 유지됩니다.</p> : null}
            </Field>
          </div>
        </div>
      </section>

      <SubmissionReviewSummary form={form} locale={previewLocale} providerLookupNotice={providerLookupNotice} onLocaleChange={setPreviewLocale} />

      <section className="border-b border-slate-200 py-5">
        <button type="button" onClick={() => onPrepareAiDraft()} disabled={generatingAiDraft} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-sm font-black text-white disabled:opacity-60 sm:w-auto">
          <Sparkles size={17} aria-hidden="true" />
          {generatingAiDraft ? "AI 콘텐츠 생성 중..." : "AI 콘텐츠 생성"}
        </button>
      </section>

      <details className="group mt-5 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 text-sm font-black text-slate-900">
          고급 편집 펼치기
          <ChevronDown size={18} className="transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-slate-200 p-4">
          <button type="button" onClick={onTranslate} disabled={translating || saving} className="mb-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 text-sm font-black text-blue-800 ring-1 ring-blue-100 disabled:opacity-60 sm:w-auto">
            <Languages size={16} aria-hidden="true" />
            {translating ? "번역 중" : "빈 설명/주소 번역"}
          </button>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="지도 링크">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={form.source_url}
                onChange={(event) => updateSourceUrl(event.target.value)}
                onBlur={normalizeSourceUrl}
                placeholder="네이버지도, 카카오맵, Google Maps 링크"
                className={[
                  inputClass,
                  form.source_url.trim() && !mapLinkState.valid ? "ring-rose-200 focus:ring-rose-200" : "",
                ].join(" ")}
              />
            <button type="button" onClick={onParseSourceUrl} disabled={analyzing || webSearching} className="shrink-0 rounded-2xl bg-slate-950 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
              {analyzing ? "분석 중" : "분석"}
            </button>
            <button type="button" onClick={onWebSearch} disabled={analyzing || webSearching || !mapLinkState.valid} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-50 px-3 text-sm font-black text-teal-800 ring-1 ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60">
              <Sparkles size={15} aria-hidden="true" />
              {webSearching ? "웹검색 중" : "웹검색 보완"}
            </button>
            </div>
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span
              className={[
                "rounded-full px-2.5 py-1 ring-1",
                mapLinkState.valid ? "bg-teal-50 text-teal-800 ring-teal-100" : "bg-rose-50 text-rose-700 ring-rose-100",
              ].join(" ")}
            >
              {mapLinkState.label}
            </span>
            <span className="text-slate-400">지원 예: 네이버지도, 카카오맵, Google Maps</span>
          </div>
          {form.source_url.trim() && !mapLinkState.valid ? <p className="mt-2 text-xs font-bold text-rose-700">{mapLinkState.message}</p> : null}
        </div>
        <Field label="Provider">
          <input value={form.provider} readOnly aria-readonly="true" className={`${inputClass} bg-slate-50 text-slate-600`} />
        </Field>
        <div className="md:col-span-2">
          <AdminAiDraftPanel
            draft={aiDraft}
            generating={generatingAiDraft}
            canApply={hasPlaceAiGeneratedContent(aiDraft?.generated_content)}
            currentContent={currentAiContent}
            onGenerate={onPrepareAiDraft}
            onApply={onApplyAiDraft}
            onCancel={onCancelAiDraft}
          />
        </div>
        <Field label="지도 장소 ID"><input value={form.source_external_id} onChange={(event) => onFieldChange("source_external_id", event.target.value)} className={inputClass} /></Field>
        <Field label="URL 주소명"><input value={form.slug} onChange={(event) => onFieldChange("slug", slugify(event.target.value))} className={inputClass} /></Field>
        <Field label="상태">
          <select value={form.status} onChange={(event) => onFieldChange("status", event.target.value as PlaceWorkflowStatus)} className={inputClass}>
            {placeWorkflowStatuses.map((workflowStatus) => (
              <option key={workflowStatus} value={workflowStatus}>{workflowStatusLabels[workflowStatus]}</option>
            ))}
          </select>
        </Field>
        <Field label="카테고리">
          <select value={form.category} onChange={(event) => onFieldChange("category", event.target.value as PlaceCategory)} className={inputClass}>
            <option value="">선택 필요</option>
            {placeCategories.map((category) => <option key={category} value={category}>{categoryLabels[category].ko}</option>)}
          </select>
        </Field>
        <Field label="장소명"><input value={form.name_ko} onChange={(event) => onFieldChange("name_ko", event.target.value)} className={inputClass} /></Field>
        <Field label="중국어 설명"><textarea value={form.description_zh} onChange={(event) => onFieldChange("description_zh", event.target.value)} className={textareaClass} /></Field>
        <Field label="한국어 설명"><textarea value={form.description_ko} onChange={(event) => onFieldChange("description_ko", event.target.value)} className={textareaClass} /></Field>
        <Field label="영어 설명"><textarea value={form.description_en} onChange={(event) => onFieldChange("description_en", event.target.value)} className={textareaClass} /></Field>
        <Field label="일본어 설명"><textarea value={form.description_ja} onChange={(event) => onFieldChange("description_ja", event.target.value)} className={textareaClass} /></Field>
        <Field label="한국어 주소"><input value={form.address_ko} onChange={(event) => onFieldChange("address_ko", event.target.value)} className={inputClass} /></Field>
        <Field label="중국어 주소"><input value={form.address_zh} onChange={(event) => onFieldChange("address_zh", event.target.value)} className={inputClass} /></Field>
        <Field label="영어 주소"><input value={form.address_en} onChange={(event) => onFieldChange("address_en", event.target.value)} className={inputClass} /></Field>
        <Field label="일본어 주소"><input value={form.address_ja} onChange={(event) => onFieldChange("address_ja", event.target.value)} className={inputClass} /></Field>
        <div className="rounded-2xl bg-teal-50 p-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-teal-950">주소 자동 좌표 변환</p>
              <p className="mt-1 text-xs font-semibold text-teal-700">좌표가 없으면 지도에 핀이 표시되지 않습니다. 저장 전에도 자동으로 한 번 검색합니다.</p>
            </div>
            <button
              type="button"
              onClick={onGeocode}
              disabled={geocoding || saving}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {geocoding ? "검색 중" : "주소로 좌표 찾기"}
            </button>
          </div>
        </div>
        <Field label="Latitude"><input value={form.latitude} onChange={(event) => onFieldChange("latitude", event.target.value)} inputMode="decimal" className={inputClass} /></Field>
        <Field label="Longitude"><input value={form.longitude} onChange={(event) => onFieldChange("longitude", event.target.value)} inputMode="decimal" className={inputClass} /></Field>
        <Field label="전화"><input value={form.phone} onChange={(event) => onFieldChange("phone", event.target.value)} className={inputClass} /></Field>
        <Field label="웹사이트"><input value={form.website} onChange={(event) => onFieldChange("website", event.target.value)} className={inputClass} /></Field>
        <Field label="영업시간"><input value={form.opening_hours} onChange={(event) => onFieldChange("opening_hours", event.target.value)} className={inputClass} /></Field>
        <Field label="휴무일"><input value={form.closed_days} onChange={(event) => onFieldChange("closed_days", event.target.value)} className={inputClass} /></Field>
        <Field label="마지막 확인일"><input type="date" value={form.last_verified_at} onChange={(event) => onFieldChange("last_verified_at", event.target.value)} className={inputClass} /></Field>
        <Field label="가격대(0-4)"><input value={form.price_level} onChange={(event) => onFieldChange("price_level", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="최소 가격"><input value={form.price_min} onChange={(event) => onFieldChange("price_min", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="최대 가격"><input value={form.price_max} onChange={(event) => onFieldChange("price_max", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <div className="md:col-span-2">
          <Field label="첫 방문 추천 주문">
            <textarea value={form.recommended_order_ko} onChange={(event) => onFieldChange("recommended_order_ko", event.target.value)} className={textareaClass} placeholder="확인된 근거가 있을 때만 표시됩니다." />
          </Field>
        </div>
        {form.menu_items.length ? (
          <div className="space-y-3 md:col-span-2">
            <p className="text-sm font-bold text-slate-700">확인된 메뉴</p>
            {form.menu_items.map((item, index) => (
              <div key={`${item.name_ko}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                <input value={item.name_ko} onChange={(event) => onFieldChange("menu_items", form.menu_items.map((menu, menuIndex) => menuIndex === index ? { ...menu, name_ko: event.target.value } : menu))} className={inputClass} aria-label={`메뉴 ${index + 1} 이름`} />
                <input value={item.price ?? ""} onChange={(event) => onFieldChange("menu_items", form.menu_items.map((menu, menuIndex) => menuIndex === index ? { ...menu, price: nullableNumber(event.target.value) } : menu))} className={inputClass} inputMode="numeric" aria-label={`메뉴 ${index + 1} 가격`} placeholder="가격 미확인" />
                <CheckField label="대표" checked={item.is_recommended} onChange={(checked) => onFieldChange("menu_items", form.menu_items.map((menu, menuIndex) => menuIndex === index ? { ...menu, is_recommended: checked } : menu))} />
              </div>
            ))}
          </div>
        ) : null}
        <Field label="가까운 역"><input value={form.nearest_station} onChange={(event) => onFieldChange("nearest_station", event.target.value)} className={inputClass} /></Field>
        <Field label="출구"><input value={form.nearest_exit} onChange={(event) => onFieldChange("nearest_exit", event.target.value)} className={inputClass} /></Field>
        <Field label="도보 시간"><input value={form.walking_minutes} onChange={(event) => onFieldChange("walking_minutes", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="대표 이미지"><input value={form.thumbnail_url} onChange={(event) => onFieldChange("thumbnail_url", event.target.value)} className={inputClass} /></Field>
        <Field label="Provider 평점"><input value={form.provider_rating} readOnly aria-readonly="true" className={`${inputClass} bg-slate-100 text-slate-600`} /></Field>
        <Field label="Provider 리뷰 수"><input value={form.provider_review_count} readOnly aria-readonly="true" className={`${inputClass} bg-slate-100 text-slate-600`} /></Field>
        <Field label="Provider 편의정보"><input value={form.provider_amenities} readOnly aria-readonly="true" className={`${inputClass} bg-slate-100 text-slate-600`} /></Field>
        <Field label="중국어 여행 팁"><textarea value={form.tips_zh} onChange={(event) => onFieldChange("tips_zh", event.target.value)} className={textareaClass} /></Field>
        <Field label="한국어 여행 팁"><textarea value={form.tips_ko} onChange={(event) => onFieldChange("tips_ko", event.target.value)} className={textareaClass} /></Field>
        <Field label="영어 여행 팁"><textarea value={form.tips_en} onChange={(event) => onFieldChange("tips_en", event.target.value)} className={textareaClass} /></Field>
        <Field label="일본어 여행 팁"><textarea value={form.tips_ja} onChange={(event) => onFieldChange("tips_ja", event.target.value)} className={textareaClass} /></Field>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            <CheckField label="혼자 가능" checked={form.solo_friendly} onChange={(checked) => onFieldChange("solo_friendly", checked)} />
            <CheckField label="캐리어 가능" checked={form.luggage_friendly} onChange={(checked) => onFieldChange("luggage_friendly", checked)} />
            <CheckField label="중국어 메뉴" checked={form.chinese_menu} onChange={(checked) => onFieldChange("chinese_menu", checked)} />
            <CheckField label="카드 가능" checked={form.card_payment} onChange={(checked) => onFieldChange("card_payment", checked)} />
          </div>
        </div>
      </details>

      {status ? <p role="status" className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-5 text-amber-800">{status}</p> : null}

      <button type="button" onClick={onPublish} disabled={saving || geocoding} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-60 sm:w-auto">
        <Send size={16} aria-hidden="true" />
        {saving ? "저장 중" : geocoding ? "좌표 검색 중" : "장소 등록"}
      </button>
    </section>
  );
}

const inputClass = "h-11 w-full rounded-2xl bg-slate-50 px-3 text-sm text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-teal-200";
const textareaClass = "min-h-24 w-full rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-teal-200";

function SubmissionReviewSummary({
  form,
  locale,
  providerLookupNotice,
  onLocaleChange,
}: {
  form: PublishForm;
  locale: PlaceContentLocale;
  providerLookupNotice: string;
  onLocaleChange: (locale: PlaceContentLocale) => void;
}) {
  const name = unifiedPlaceName(form);
  const localized = {
    ko: { name, address: form.address_ko, description: form.description_ko, tip: form.tips_ko },
    zh: { name, address: form.address_zh, description: form.description_zh, tip: form.tips_zh },
    en: { name, address: form.address_en, description: form.description_en, tip: form.tips_en },
    ja: { name, address: form.address_ja, description: form.description_ja, tip: form.tips_ja },
  } satisfies Record<PlaceContentLocale, { name: string; address: string; description: string; tip: string }>;
  const selected = localized[locale];
  const facts = [
    { field: "name", label: "장소명", available: Boolean(name) },
    { field: "category", label: "카테고리", available: Boolean(form.category) },
    { field: "address", label: "주소", available: Boolean(form.address_ko.trim()) },
    { field: "coordinates", label: "좌표", available: hasValidFormCoordinates(form) },
    { field: "phone", label: "전화번호", available: Boolean(form.phone.trim()) },
    { field: "openingHours", label: "영업시간", available: Boolean(form.opening_hours.trim()) },
    { field: "photos", label: "사진", available: Boolean(form.thumbnail_url.trim() || form.provider_image_preview_url.trim()) },
    { field: "priceLevel", label: "가격대", available: Boolean(form.price_level.trim()) },
    { field: "rating", label: "평점", available: Boolean(form.provider_rating.trim()) },
    { field: "reviewCount", label: "리뷰 수", available: Boolean(form.provider_review_count.trim()) },
    { field: "menu", label: "메뉴", available: form.menu_items.some((item) => Boolean(item.name_ko.trim())) },
    { field: "waiting", label: "웨이팅", available: form.waiting_level !== "unknown" },
    { field: "recommendedOrder", label: "첫 주문 정보", available: Boolean(form.recommended_order_ko.trim()) },
    { field: "website", label: "홈페이지", available: Boolean(form.website.trim()) },
    { field: "providerPlaceId", label: "Place ID", available: Boolean(form.source_external_id.trim()) },
  ] as const;
  const provider = toSupportedProvider(form.provider);
  const unavailable = provider
    ? getProviderUnavailableCapabilities(provider, {
        name,
        category: form.category,
        addressKo: form.address_ko,
        roadAddressKo: undefined,
        formattedAddress: undefined,
        latitude: hasValidFormCoordinates(form) ? Number(form.latitude) : undefined,
        longitude: hasValidFormCoordinates(form) ? Number(form.longitude) : undefined,
        phone: form.phone,
        website: form.website,
        openingHours: form.opening_hours,
        currentOpeningHours: undefined,
        rating: form.provider_rating ? Number(form.provider_rating) : undefined,
        reviewCount: form.provider_review_count ? Number(form.provider_review_count) : undefined,
        priceLevel: form.price_level ? Number(form.price_level) : undefined,
        photos: form.thumbnail_url || form.provider_image_preview_url ? [{ url: form.thumbnail_url || form.provider_image_preview_url, persistence: "preview_only" as const }] : undefined,
        providerPlaceId: form.source_external_id,
        sourceUrl: form.source_url,
      })
    : [];
  const missingLabels = Array.from(new Set([...facts.filter((fact) => !fact.available).map((fact) => fact.label), ...unavailable.map((fact) => fact.label)]));

  return (
    <section className="border-b border-slate-200 py-5">
      <h4 className="text-sm font-black text-slate-950">3. 자동수집 / AI 결과 미리보기</h4>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {facts.filter((fact) => fact.available).map((fact) => (
            <div key={fact.label} className="flex min-h-9 items-center gap-2 text-sm font-semibold text-slate-700">
              <CheckCircle2 size={16} className="text-teal-700" aria-hidden="true" />
              <span>{fact.label}</span>
              {formatPlaceFactSource(getFieldSource(form.source_metadata, fact.field)) ? <span className="text-xs font-medium text-slate-400">{formatPlaceFactSource(getFieldSource(form.source_metadata, fact.field))}</span> : null}
            </div>
          ))}
          {missingLabels.length ? <p className="text-xs font-semibold leading-5 text-slate-500 sm:col-span-2">{missingLabels.join(" · ")} 정보 없음</p> : null}
        </div>
        {providerLookupNotice ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800 lg:col-span-2">{providerLookupNotice}</p> : null}
        <div className="grid grid-cols-4 gap-1">
          {(["ko", "zh", "en", "ja"] as const).map((item) => {
            const complete = Boolean(localized[item].description.trim() && localized[item].tip.trim());
            return <div key={item} className="flex min-h-10 items-center justify-center gap-1 text-xs font-black uppercase">{complete ? <CheckCircle2 size={15} className="text-teal-700" /> : <XCircle size={15} className="text-rose-500" />}{item}</div>;
          })}
        </div>
      </div>
      <div className="mt-3 flex min-h-9 items-center gap-2 text-sm font-semibold text-slate-700">
        {form.admin_summary.trim() ? <CheckCircle2 size={16} className="text-teal-700" aria-hidden="true" /> : <XCircle size={16} className="text-rose-500" aria-hidden="true" />}
        관리자 내부 메모{form.admin_summary.trim() ? " 생성 완료" : " 없음"}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
        {(["ko", "zh", "en", "ja"] as const).map((item) => (
          <button key={item} type="button" onClick={() => onLocaleChange(item)} className={["min-h-11 rounded-md text-xs font-black uppercase", locale === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"].join(" ")}>{item}</button>
        ))}
      </div>
      <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <SubmissionPreviewValue label="장소명" value={selected.name} />
        <SubmissionPreviewValue label="주소" value={selected.address} />
        <SubmissionPreviewValue label="설명" value={selected.description} />
        <SubmissionPreviewValue label="여행 팁" value={selected.tip} />
        {!Object.values(selected).some((value) => value.trim()) ? <p className="text-sm font-semibold text-slate-400">이 언어로 생성된 내용이 없습니다.</p> : null}
      </div>
    </section>
  );
}

function getFieldSource(sourceMetadata: Record<string, unknown> | null, field: string) {
  const sources = sourceMetadata?.field_sources;
  return sources && typeof sources === "object" && !Array.isArray(sources)
    ? (sources as Record<string, unknown>)[field]
    : undefined;
}

function readNormalizedMenu(sourceMetadata: Record<string, unknown> | null): NormalizedPlace["menu"] | undefined {
  const raw = sourceMetadata?.menu;
  if (!Array.isArray(raw)) return undefined;
  const menu = raw.filter((item): item is NonNullable<NormalizedPlace["menu"]>[number] => (
    Boolean(item) && typeof item === "object" && typeof (item as { name?: unknown }).name === "string"
  ));
  return menu.length ? menu : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  return values.length ? values : undefined;
}

function SubmissionPreviewValue({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return <div><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {checked ? <CheckCircle2 size={16} className="text-teal-700" aria-hidden="true" /> : null}
      {label}
    </label>
  );
}
