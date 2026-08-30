"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Eye, Languages, Pencil, Plus, RotateCcw, Save, Star, Trash2, X, type LucideIcon } from "lucide-react";
import { AdminAiDraftPanel } from "@/components/AdminAiDraftPanel";
import { EmptyState } from "@/components/EmptyState";
import { TagChip } from "@/components/TagChip";
import { buildAdminPlaceVisibilityNotice } from "@/lib/admin-place-visibility";
import {
  buildChinaPlaceSummary,
  ratingHelp,
  tristateLabel,
  waitingLabel,
  type ChinaRatingKey,
} from "@/lib/place-china/format";
import { buildPlaceSourceData, hasPlaceAiGeneratedContent } from "@/lib/place-ai/content-draft";
import { canUseNaverGeocoder, geocodeKoreanAddress } from "@/lib/naver-geocoder";
import {
  categoryLabels,
  placeCategories,
  type ChinaMinimumOrderPolicy,
  type ChinaWaitingLevel,
  type PlaceCategory,
  type PlaceChinaInfoPayload,
  type PlaceFactTristate,
  type PlacePayload,
  type PlaceSourceProvider,
  type PlaceWithRelations,
} from "@/types/database";
import type { PlaceAiGeneratedContent, PlaceAiGenerationResponse } from "@/types/place-ai";

type AdminPlaceManagerProps = {
  initialPlaces: PlaceWithRelations[];
  source: "supabase" | "demo";
  error?: string;
  supabaseConfigured: boolean;
  adminAccessToken?: string;
};

type MenuDraft = {
  name_ko: string;
  name_zh: string;
  description_zh: string;
  price: string;
  is_recommended: boolean;
  sort_order: string;
};

type FormState = {
  id?: string;
  source_url: string;
  source_provider: PlaceSourceProvider;
  source_external_id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  name_ja: string;
  name_ko: string;
  category: PlaceCategory;
  short_description_zh: string;
  short_description_en: string;
  short_description_ja: string;
  short_description_ko: string;
  address_ko: string;
  address_zh: string;
  latitude: string;
  longitude: string;
  nearest_station: string;
  nearest_exit: string;
  walking_minutes: string;
  price_min: string;
  price_max: string;
  opening_hours: string;
  recommended_order_zh: string;
  recommended_order_ko: string;
  tips_zh: string;
  tips_en: string;
  tips_ja: string;
  tips_ko: string;
  thumbnail_url: string;
  is_featured: boolean;
  is_active: boolean;
  tags_text: string;
  menu_items: MenuDraft[];
  china_info: ChinaInfoForm;
};

type ChinaInfoForm = Omit<
  PlaceChinaInfoPayload,
  "minimum_order_people" | "subway_walk_minutes" | "waiting_minutes_min" | "waiting_minutes_max" | "verified_at"
> & {
  minimum_order_people: string;
  subway_walk_minutes: string;
  waiting_minutes_min: string;
  waiting_minutes_max: string;
  verified_at: string;
};

type RatingConfig = {
  key: ChinaRatingKey;
  title: string;
};

type TriStateConfig = {
  key: keyof Pick<
    ChinaInfoForm,
    | "chinese_menu"
    | "foreign_card"
    | "alipay"
    | "wechat_pay"
    | "solo_friendly"
    | "luggage_friendly"
    | "toilet_available"
    | "reservation_required"
    | "xiaohongshu_popular"
    | "photo_recommended"
    | "tourism_recommended"
  >;
  label: string;
  help: string;
};

type AdminTranslationFields = {
  name_ko: string;
  name_zh: string;
  name_en: string;
  short_description_ko: string;
  short_description_zh: string;
  short_description_en: string;
  description_ko: string;
  description_zh: string;
  description_en: string;
  tips_ko: string;
  tips_zh: string;
  tips_en: string;
  recommended_order_ko: string;
  recommended_order_zh: string;
  address_ko: string;
  address_zh: string;
};

const localStorageKey = "busan-travel-assistant-admin-places";
const defaultImage = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
const scoreOptions = [1, 2, 3, 4, 5] as const;

const ratingControls: RatingConfig[] = [
  { key: "chinese_taste_score", title: "중국인 추천도" },
  { key: "spicy_level", title: "매운맛" },
  { key: "greasy_level", title: "느끼함" },
  { key: "smell_level", title: "향/잡내" },
  { key: "portion_level", title: "양" },
  { key: "ordering_difficulty", title: "주문 난이도" },
];

const convenienceControls: TriStateConfig[] = [
  { key: "chinese_menu", label: "중국어 메뉴", help: "메뉴판이나 키오스크에 중국어 지원이 있는지" },
  { key: "foreign_card", label: "해외카드", help: "중국/해외 발급 카드 결제 가능 여부" },
  { key: "alipay", label: "Alipay", help: "支付宝 결제 가능 여부" },
  { key: "wechat_pay", label: "WeChat Pay", help: "微信支付 가능 여부" },
  { key: "solo_friendly", label: "혼밥", help: "1인 방문/주문이 자연스러운지" },
  { key: "luggage_friendly", label: "캐리어", help: "큰 캐리어를 들고 들어가기 괜찮은지" },
  { key: "toilet_available", label: "화장실", help: "매장 내부 또는 바로 이용 가능한 화장실" },
  { key: "reservation_required", label: "예약 필요", help: "예약이 필수이거나 강하게 권장되는지" },
];

const xiaohongshuControls: TriStateConfig[] = [
  { key: "xiaohongshu_popular", label: "小红书热门", help: "샤오홍슈에서 언급/저장 가치가 높은 장소인지" },
  { key: "photo_recommended", label: "사진 촬영 목적", help: "사진을 찍기 위해 방문할 만한지" },
  { key: "tourism_recommended", label: "일반 관광 목적", help: "관광 코스에 넣기 좋은지" },
];

const waitingOptions: Array<{ value: ChinaWaitingLevel; label: string; min: string; max: string }> = [
  { value: "none", label: "거의 없음", min: "0", max: "0" },
  { value: "short", label: "5~10분", min: "5", max: "10" },
  { value: "moderate", label: "10~20분", min: "10", max: "20" },
  { value: "long", label: "20~40분", min: "20", max: "40" },
  { value: "extreme", label: "40분 이상", min: "40", max: "" },
  { value: "varies", label: "시간대에 따라 다름", min: "", max: "" },
  { value: "unknown", label: "확인 필요", min: "", max: "" },
];

const minimumOrderOptions: Array<{ value: ChinaMinimumOrderPolicy; label: string; people: string }> = [
  { value: "none", label: "제한 없음", people: "1" },
  { value: "two_plus", label: "2인분 이상", people: "2" },
  { value: "three_plus", label: "3인분 이상", people: "3" },
  { value: "other", label: "기타", people: "" },
  { value: "unknown", label: "확인 필요", people: "" },
];

function createEmptyChinaInfo(): ChinaInfoForm {
  return {
    chinese_taste_score: null,
    spicy_level: null,
    greasy_level: null,
    smell_level: null,
    portion_level: null,
    ordering_difficulty: null,
    waiting_level: "unknown",
    waiting_minutes_min: "",
    waiting_minutes_max: "",
    chinese_menu: "unknown",
    foreign_card: "unknown",
    alipay: "unknown",
    wechat_pay: "unknown",
    solo_friendly: "unknown",
    luggage_friendly: "unknown",
    toilet_available: "unknown",
    reservation_required: "unknown",
    minimum_order_people: "",
    minimum_order_policy: "unknown",
    minimum_order_note: "",
    xiaohongshu_popular: "unknown",
    photo_recommended: "unknown",
    tourism_recommended: "unknown",
    subway_walk_minutes: "",
    manual_summary_override: "",
    manual_warning_override: "",
    verification_status: "unverified",
    verified_at: "",
  };
}

function createEmptyForm(): FormState {
  return {
    source_url: "",
    source_provider: "NAVER",
    source_external_id: "",
    slug: "",
    name_zh: "",
    name_en: "",
    name_ja: "",
    name_ko: "",
    category: "restaurant",
    short_description_zh: "",
    short_description_en: "",
    short_description_ja: "",
    short_description_ko: "",
    address_ko: "",
    address_zh: "",
    latitude: "",
    longitude: "",
    nearest_station: "광안역",
    nearest_exit: "",
    walking_minutes: "8",
    price_min: "",
    price_max: "",
    opening_hours: "",
    recommended_order_zh: "",
    recommended_order_ko: "",
    tips_zh: "",
    tips_en: "",
    tips_ja: "",
    tips_ko: "",
    thumbnail_url: defaultImage,
    is_featured: false,
    is_active: true,
    tags_text: "当地人常去 | 현지인이 자주 감 | local",
    menu_items: [],
    china_info: createEmptyChinaInfo(),
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toForm(place: PlaceWithRelations): FormState {
  const en = place.translations?.find((translation) => translation.locale === "en");
  const ja = place.translations?.find((translation) => translation.locale === "ja");
  const chinaInfo = { ...createEmptyChinaInfo(), ...(place.china_info ?? {}) };

  return {
    id: place.id,
    source_url: "",
    source_provider: "MANUAL",
    source_external_id: "",
    slug: place.slug,
    name_zh: place.name_zh,
    name_en: en?.name ?? "",
    name_ja: ja?.name ?? "",
    name_ko: place.name_ko,
    category: place.category,
    short_description_zh: place.short_description_zh,
    short_description_en: en?.description ?? "",
    short_description_ja: ja?.description ?? "",
    short_description_ko: place.short_description_ko,
    address_ko: place.address_ko,
    address_zh: place.address_zh,
    latitude: place.latitude?.toString() ?? "",
    longitude: place.longitude?.toString() ?? "",
    nearest_station: place.nearest_station,
    nearest_exit: place.nearest_exit,
    walking_minutes: place.walking_minutes.toString(),
    price_min: place.price_min?.toString() ?? "",
    price_max: place.price_max?.toString() ?? "",
    opening_hours: place.opening_hours,
    recommended_order_zh: place.recommended_order_zh,
    recommended_order_ko: place.recommended_order_ko,
    tips_zh: place.tips_zh,
    tips_en: en?.travel_tip ?? "",
    tips_ja: ja?.travel_tip ?? "",
    tips_ko: place.tips_ko,
    thumbnail_url: place.thumbnail_url,
    is_featured: place.is_featured,
    is_active: place.is_active,
    tags_text: place.tags.map((tag) => `${tag.label_zh} | ${tag.label_ko} | ${tag.slug}`).join("\n"),
    menu_items: place.menu_items.map((item) => ({
      name_ko: item.name_ko,
      name_zh: item.name_zh,
      description_zh: item.description_zh,
      price: item.price?.toString() ?? "",
      is_recommended: item.is_recommended,
      sort_order: item.sort_order.toString(),
    })),
    china_info: {
      ...chinaInfo,
      waiting_minutes_min: chinaInfo.waiting_minutes_min?.toString() ?? "",
      waiting_minutes_max: chinaInfo.waiting_minutes_max?.toString() ?? "",
      minimum_order_people: chinaInfo.minimum_order_people?.toString() ?? "",
      minimum_order_note: chinaInfo.minimum_order_note ?? "",
      subway_walk_minutes: chinaInfo.subway_walk_minutes?.toString() ?? "",
      manual_summary_override: chinaInfo.manual_summary_override ?? "",
      manual_warning_override: chinaInfo.manual_warning_override ?? "",
      verified_at: chinaInfo.verified_at ?? "",
    },
  };
}

function nullableNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function hasCoordinateInput(form: Pick<FormState, "latitude" | "longitude">) {
  return nullableNumber(form.latitude) !== null && nullableNumber(form.longitude) !== null;
}

function geocodeQueryFromForm(form: Pick<FormState, "address_ko" | "address_zh" | "name_ko" | "name_zh">) {
  return [form.address_ko, form.address_zh, form.name_ko, form.name_zh].find((value) => value.trim())?.trim() ?? "";
}

function nullableInteger(value: string) {
  const number = nullableNumber(value);
  return number === null ? null : Math.max(0, Math.round(number));
}

function toChinaInfoPayload(form: ChinaInfoForm): PlaceChinaInfoPayload {
  return {
    ...form,
    waiting_minutes_min: nullableInteger(form.waiting_minutes_min),
    waiting_minutes_max: nullableInteger(form.waiting_minutes_max),
    minimum_order_people: nullableInteger(form.minimum_order_people),
    minimum_order_note: form.minimum_order_note?.trim() || null,
    subway_walk_minutes: nullableInteger(form.subway_walk_minutes),
    manual_summary_override: form.manual_summary_override?.trim() || null,
    manual_warning_override: form.manual_warning_override?.trim() || null,
    verified_at: form.verified_at || null,
  };
}

function toPayload(form: FormState): PlacePayload {
  const tags = form.tags_text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelZh = "", labelKo = "", rawSlug = ""] = line.split("|").map((part) => part.trim());
      const slug = rawSlug || slugify(labelKo || labelZh);

      return {
        label_zh: labelZh,
        label_ko: labelKo || labelZh,
        slug,
      };
    })
    .filter((tag) => tag.label_zh && tag.label_ko && tag.slug);
  const chinaInfo = toChinaInfoPayload(form.china_info);

  return {
    slug: form.slug || slugify(form.name_ko || form.name_zh),
    name_zh: form.name_zh,
    name_ko: form.name_ko,
    category: form.category,
    short_description_zh: form.short_description_zh,
    short_description_ko: form.short_description_ko,
    address_ko: form.address_ko,
    address_zh: form.address_zh,
    latitude: nullableNumber(form.latitude),
    longitude: nullableNumber(form.longitude),
    nearest_station: form.nearest_station,
    nearest_exit: form.nearest_exit,
    walking_minutes: Number(form.walking_minutes) || 0,
    price_min: nullableNumber(form.price_min),
    price_max: nullableNumber(form.price_max),
    opening_hours: form.opening_hours,
    waiting_info_zh: "",
    waiting_info_ko: "",
    solo_friendly: chinaInfo.solo_friendly === "yes",
    luggage_friendly: chinaInfo.luggage_friendly === "yes",
    chinese_menu: chinaInfo.chinese_menu === "yes",
    card_payment: chinaInfo.foreign_card === "yes",
    recommended_order_zh: form.recommended_order_zh,
    recommended_order_ko: form.recommended_order_ko,
    tips_zh: form.tips_zh,
    tips_ko: form.tips_ko,
    thumbnail_url: form.thumbnail_url || defaultImage,
    is_featured: form.is_featured,
    is_active: form.is_active,
    tags,
    menu_items: form.menu_items
      .filter((item) => item.name_ko.trim() || item.name_zh.trim())
      .map((item, index) => ({
        name_ko: item.name_ko,
        name_zh: item.name_zh,
        description_zh: item.description_zh,
        price: nullableNumber(item.price),
        is_recommended: item.is_recommended,
        sort_order: Number(item.sort_order) || index + 1,
      })),
    translations: [
      {
        locale: "zh",
        name: form.name_zh,
        description: form.short_description_zh,
        travel_tip: form.tips_zh,
      },
      {
        locale: "ko",
        name: form.name_ko,
        description: form.short_description_ko,
        travel_tip: form.tips_ko,
      },
      form.name_en.trim()
        ? {
            locale: "en" as const,
            name: form.name_en,
            description: form.short_description_en,
            travel_tip: form.tips_en,
          }
        : null,
      form.name_ja.trim()
        ? {
            locale: "ja" as const,
            name: form.name_ja,
            description: form.short_description_ja,
            travel_tip: form.tips_ja,
          }
        : null,
    ].filter((translation): translation is NonNullable<PlacePayload["translations"]>[number] => Boolean(translation)),
    source: form.source_url.trim()
      ? {
          provider: form.source_provider,
          source_url: form.source_url.trim(),
          external_id: form.source_external_id.trim() || null,
        }
      : undefined,
    china_info: chinaInfo,
  };
}

function applyGeneratedContentToForm(form: FormState, content: PlaceAiGeneratedContent): FormState {
  const fill = (current: string, generated: string) => current.trim() || generated;
  const nextForm = {
    ...form,
    short_description_ko: fill(form.short_description_ko, content.description_ko),
    short_description_zh: fill(form.short_description_zh, content.description_zh),
    short_description_en: fill(form.short_description_en, content.description_en),
    short_description_ja: fill(form.short_description_ja, content.description_ja),
  };
  const tipText = [...content.traveler_tips, ...content.cautions].filter(Boolean).join(" ");

  return {
    ...nextForm,
    tips_ko: fill(form.tips_ko, content.description_ko || tipText),
    tips_zh: fill(form.tips_zh, content.description_zh || tipText),
    tips_en: fill(form.tips_en, content.description_en || tipText),
    tips_ja: fill(form.tips_ja, content.description_ja || tipText),
  };
}

function localPlaceFromPayload(payload: PlacePayload, id?: string): PlaceWithRelations {
  const placeId = id ?? `local-${Date.now()}`;
  const now = new Date().toISOString();
  const { translations, source, china_info: chinaInfo, ...placePayload } = payload;
  void translations;
  void source;

  return {
    ...placePayload,
    id: placeId,
    created_at: now,
    updated_at: now,
    china_info: chinaInfo
      ? {
          ...chinaInfo,
          id: `local-china-${placeId}`,
          place_id: placeId,
          created_at: now,
          updated_at: now,
        }
      : null,
    tags: payload.tags.map((tag) => ({
      ...tag,
      id: `local-tag-${tag.slug}`,
    })),
    menu_items: payload.menu_items.map((item, index) => ({
      ...item,
      id: `local-menu-${placeId}-${index}`,
      place_id: placeId,
    })),
  };
}

function buildTranslationFieldsFromForm(form: FormState): AdminTranslationFields {
  return {
    name_ko: form.name_ko,
    name_zh: form.name_zh,
    name_en: form.name_en,
    short_description_ko: form.short_description_ko,
    short_description_zh: form.short_description_zh,
    short_description_en: form.short_description_en,
    description_ko: form.short_description_ko,
    description_zh: form.short_description_zh,
    description_en: form.short_description_en,
    tips_ko: form.tips_ko,
    tips_zh: form.tips_zh,
    tips_en: form.tips_en,
    recommended_order_ko: form.recommended_order_ko,
    recommended_order_zh: form.recommended_order_zh,
    address_ko: form.address_ko,
    address_zh: form.address_zh,
  };
}

function applyTranslationsToForm(form: FormState, translations: Partial<AdminTranslationFields>) {
  let filledCount = 0;
  const fill = (current: string, translated?: string) => {
    if (current.trim() || !translated?.trim()) {
      return current;
    }

    filledCount += 1;
    return translated.trim();
  };
  const nextForm: FormState = {
    ...form,
    name_ko: fill(form.name_ko, translations.name_ko),
    name_zh: fill(form.name_zh, translations.name_zh),
    name_en: fill(form.name_en, translations.name_en),
    short_description_ko: fill(form.short_description_ko, translations.short_description_ko || translations.description_ko),
    short_description_zh: fill(form.short_description_zh, translations.short_description_zh || translations.description_zh),
    short_description_en: fill(form.short_description_en, translations.short_description_en || translations.description_en),
    tips_ko: fill(form.tips_ko, translations.tips_ko),
    tips_zh: fill(form.tips_zh, translations.tips_zh),
    tips_en: fill(form.tips_en, translations.tips_en),
    recommended_order_ko: fill(form.recommended_order_ko, translations.recommended_order_ko),
    recommended_order_zh: fill(form.recommended_order_zh, translations.recommended_order_zh),
    address_ko: fill(form.address_ko, translations.address_ko),
    address_zh: fill(form.address_zh, translations.address_zh),
  };

  return { nextForm, filledCount };
}

export function AdminPlaceManager({ initialPlaces, source, error, supabaseConfigured, adminAccessToken }: AdminPlaceManagerProps) {
  const [places, setPlaces] = useState(initialPlaces);
  const [form, setForm] = useState<FormState>(() => (initialPlaces[0] ? toForm(initialPlaces[0]) : createEmptyForm()));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [generatingAiDraft, setGeneratingAiDraft] = useState(false);
  const [aiDraft, setAiDraft] = useState<PlaceAiGenerationResponse | null>(null);
  const [status, setStatus] = useState(error ?? "");
  const preview = useMemo(() => buildChinaPlaceSummary(toChinaInfoPayload(form.china_info)), [form.china_info]);

  const activeCount = useMemo(() => places.filter((place) => place.is_active).length, [places]);
  const featuredCount = useMemo(() => places.filter((place) => place.is_featured).length, [places]);
  const visiblePlaces = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    if (!lowered) {
      return places;
    }

    return places.filter((place) =>
      [place.name_ko, place.name_zh, place.slug, place.address_ko, place.address_zh, place.nearest_station]
        .join(" ")
        .toLowerCase()
        .includes(lowered),
    );
  }, [places, query]);

  function adminHeaders() {
    return {
      "Content-Type": "application/json",
      ...(adminAccessToken ? { Authorization: `Bearer ${adminAccessToken}` } : {}),
    };
  }

  useEffect(() => {
    setPlaces(initialPlaces);
  }, [initialPlaces]);

  function persistLocal(nextPlaces: PlaceWithRelations[]) {
    setPlaces(nextPlaces);
    window.localStorage.setItem(localStorageKey, JSON.stringify(nextPlaces));
  }

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function prepareAiDraft() {
    const payload = toPayload(form);

    if (!payload.name_ko && !payload.name_zh) {
      setStatus("AI 생성 준비에는 장소명이 필요합니다.");
      return;
    }

    setGeneratingAiDraft(true);
    setStatus("여행자용 설명 생성 중입니다.");

    try {
      const response = await fetch("/api/admin/place-ai-generation", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          source_data: buildPlaceSourceData(payload),
          locale_targets: ["ko", "zh", "en", "ja"],
          existing_content: {
            description_ko: form.short_description_ko,
            description_zh: form.short_description_zh,
            description_en: form.short_description_en,
            description_ja: form.short_description_ja,
            traveler_tips: [form.tips_ko, form.tips_zh, form.tips_en, form.tips_ja].filter(Boolean),
          },
        }),
      });
      const body = (await response.json()) as PlaceAiGenerationResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in body ? body.message : "AI 생성 준비에 실패했습니다.");
      }

      setAiDraft(body as PlaceAiGenerationResponse);
      setStatus((body as PlaceAiGenerationResponse).message);
    } catch (draftError) {
      setStatus(draftError instanceof Error ? draftError.message : "AI 생성 준비 중 오류가 발생했습니다.");
    } finally {
      setGeneratingAiDraft(false);
    }
  }

  function applyAiDraft() {
    if (!aiDraft || !hasPlaceAiGeneratedContent(aiDraft.generated_content)) {
      setStatus("적용할 AI 생성 결과가 없습니다. 이번 단계에서는 실제 AI API를 호출하지 않습니다.");
      return;
    }

    const content = aiDraft.generated_content;
    setForm((current) => applyGeneratedContentToForm(current, content));
    setStatus("AI 생성 결과를 입력 폼에 적용했습니다. DB 저장은 저장 버튼을 눌러야 반영됩니다.");
  }

  function updateChinaField<Key extends keyof ChinaInfoForm>(key: Key, value: ChinaInfoForm[Key]) {
    setForm((current) => ({
      ...current,
      china_info: {
        ...current.china_info,
        [key]: value,
      },
    }));
  }

  function updateWaiting(value: ChinaWaitingLevel) {
    const option = waitingOptions.find((item) => item.value === value);

    setForm((current) => ({
      ...current,
      china_info: {
        ...current.china_info,
        waiting_level: value,
        waiting_minutes_min: option?.min ?? "",
        waiting_minutes_max: option?.max ?? "",
      },
    }));
  }

  function updateMinimumOrder(value: ChinaMinimumOrderPolicy) {
    const option = minimumOrderOptions.find((item) => item.value === value);

    setForm((current) => ({
      ...current,
      china_info: {
        ...current.china_info,
        minimum_order_policy: value,
        minimum_order_people: option?.people ?? "",
        minimum_order_note: value === "other" ? current.china_info.minimum_order_note : "",
      },
    }));
  }

  function resetChinaInfoToUnknown() {
    setForm((current) => ({
      ...current,
      china_info: {
        ...createEmptyChinaInfo(),
        manual_summary_override: current.china_info.manual_summary_override,
        manual_warning_override: current.china_info.manual_warning_override,
      },
    }));
    setStatus("중국인 특화 구조화 정보를 모두 확인 필요 상태로 되돌렸습니다.");
  }

  async function resolveCoordinatesForForm(currentForm: FormState) {
    const address = geocodeQueryFromForm(currentForm);

    if (!address || !canUseNaverGeocoder()) {
      return currentForm;
    }

    const [result] = await geocodeKoreanAddress(address);

    if (!result) {
      return currentForm;
    }

    return {
      ...currentForm,
      latitude: result.latitude.toFixed(7),
      longitude: result.longitude.toFixed(7),
      address_ko: currentForm.address_ko || result.roadAddress || result.jibunAddress || result.address,
    };
  }

  async function fillCoordinatesFromAddress() {
    const address = geocodeQueryFromForm(form);

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
      const nextForm = await resolveCoordinatesForForm(form);

      if (!hasCoordinateInput(nextForm)) {
        setStatus("주소 검색 결과가 없습니다.");
        return;
      }

      setForm(nextForm);
      setStatus(`좌표를 입력했습니다: ${nextForm.latitude}, ${nextForm.longitude}`);
    } catch (geocodeError) {
      setStatus(geocodeError instanceof Error ? geocodeError.message : "주소 좌표 변환에 실패했습니다.");
    } finally {
      setGeocoding(false);
    }
  }

  async function translateTextFields() {
    const fields = buildTranslationFieldsFromForm(form);

    if (!Object.values(fields).some((value) => value.trim())) {
      setStatus("번역할 한국어/중국어/영어 텍스트를 먼저 입력해 주세요.");
      return;
    }

    setTranslating(true);
    setStatus("OpenAI API로 비어 있는 번역 칸을 채우는 중입니다.");

    try {
      const response = await fetch("/api/admin/translate-place", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ fields }),
      });
      const body = (await response.json()) as { translations?: Partial<AdminTranslationFields>; message?: string };

      if (!response.ok) {
        throw new Error(body.message ?? "AI 번역에 실패했습니다.");
      }

      const { nextForm, filledCount } = applyTranslationsToForm(form, body.translations ?? {});
      setForm(nextForm);
      setStatus(filledCount > 0 ? `AI 번역으로 빈칸 ${filledCount}개를 채웠습니다.` : "이미 입력된 값은 유지했습니다. 채울 빈칸이 없습니다.");
    } catch (translationError) {
      setStatus(translationError instanceof Error ? translationError.message : "AI 번역 중 오류가 발생했습니다.");
    } finally {
      setTranslating(false);
    }
  }

  async function savePlace(nextForm = form) {
    let formToSave = nextForm;

    if (!formToSave.name_zh || !formToSave.name_ko || !(formToSave.slug || slugify(formToSave.name_ko || formToSave.name_zh))) {
      setStatus("중국어 이름, 한국어 이름, slug는 필수입니다.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      if (!hasCoordinateInput(formToSave) && geocodeQueryFromForm(formToSave) && canUseNaverGeocoder()) {
        setGeocoding(true);
        setStatus("좌표가 비어 있어 주소로 자동 검색하는 중입니다.");

        try {
          formToSave = await resolveCoordinatesForForm(formToSave);
          setForm(formToSave);
        } catch (geocodeError) {
          setStatus(geocodeError instanceof Error ? `좌표 자동 변환 실패: ${geocodeError.message}` : "좌표 자동 변환에 실패했습니다.");
        } finally {
          setGeocoding(false);
        }
      }

      const payload = toPayload(formToSave);

      if (!supabaseConfigured) {
        const localPlace = localPlaceFromPayload(payload, nextForm.id);
        const nextPlaces = nextForm.id
          ? places.map((place) => (place.id === nextForm.id ? localPlace : place))
          : [localPlace, ...places];
        persistLocal(nextPlaces);
        setForm(toForm(localPlace));
        setStatus(`Supabase 미설정 상태라 브라우저 demo 저장소에 저장했습니다. ${buildAdminPlaceVisibilityNotice(localPlace)}`);
        return;
      }

      const response = await fetch(formToSave.id ? `/api/admin/places/${formToSave.id}` : "/api/admin/places", {
        method: formToSave.id ? "PUT" : "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "저장에 실패했습니다.");
      }

      const body = (await response.json()) as { place: PlaceWithRelations };
      const savedPlace = body.place;
      setPlaces((current) =>
        formToSave.id ? current.map((place) => (place.id === savedPlace.id ? savedPlace : place)) : [savedPlace, ...current],
      );
      setForm(toForm(savedPlace));
      setStatus(`저장했습니다. 중국인 특화 구조화 정보도 함께 반영됩니다. ${buildAdminPlaceVisibilityNotice(savedPlace)}`);
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setGeocoding(false);
      setSaving(false);
    }
  }

  async function deleteSelected(place: PlaceWithRelations) {
    const confirmed = window.confirm(`${place.name_ko} 장소를 비공개 처리할까요?`);

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      if (supabaseConfigured) {
        const response = await fetch(`/api/admin/places/${place.id}`, {
          method: "DELETE",
          headers: adminHeaders(),
        });

        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? "삭제에 실패했습니다.");
        }
      }

      const nextPlaces = places.filter((item) => item.id !== place.id);
      if (supabaseConfigured) {
        setPlaces(nextPlaces);
      } else {
        persistLocal(nextPlaces);
      }
      setForm(nextPlaces[0] ? toForm(nextPlaces[0]) : createEmptyForm());
      setStatus("비공개 처리했습니다.");
    } catch (deleteError) {
      setStatus(deleteError instanceof Error ? deleteError.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePlace(place: PlaceWithRelations, key: "is_active" | "is_featured") {
    await savePlace({ ...toForm(place), [key]: !place[key] });
  }

  function addMenu() {
    updateField("menu_items", [
      ...form.menu_items,
      {
        name_ko: "",
        name_zh: "",
        description_zh: "",
        price: "",
        is_recommended: false,
        sort_order: (form.menu_items.length + 1).toString(),
      },
    ]);
  }

  function updateMenu(index: number, patch: Partial<MenuDraft>) {
    updateField(
      "menu_items",
      form.menu_items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function removeMenu(index: number) {
    updateField(
      "menu_items",
      form.menu_items.filter((_item, itemIndex) => itemIndex !== index),
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="전체" value={places.length.toString()} />
          <Stat label="활성" value={activeCount.toString()} />
          <Stat label="추천" value={featuredCount.toString()} />
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(createEmptyForm());
            setAiDraft(null);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-95"
        >
          <Plus size={17} aria-hidden="true" />
          새 장소 추가
        </button>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="장소 검색"
          className="h-11 w-full rounded-2xl bg-white px-3 text-sm outline-none ring-1 ring-slate-200"
        />
        <div className="rounded-[24px] bg-white p-2 shadow-sm ring-1 ring-slate-200">
          {visiblePlaces.length > 0 ? (
            visiblePlaces.map((place) => (
              <div key={place.id} className="rounded-[20px] p-3 transition hover:bg-slate-50">
                <button type="button" onClick={() => {
                  setForm(toForm(place));
                  setAiDraft(null);
                }} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950">{place.name_ko}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{place.name_zh}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      {categoryLabels[place.category].ko}
                    </span>
                  </div>
                </button>
                <div className="mt-3 flex gap-2">
                  <IconButton label="수정" onClick={() => {
                    setForm(toForm(place));
                    setAiDraft(null);
                  }} icon={Pencil} />
                  <IconButton label="활성 토글" onClick={() => void togglePlace(place, "is_active")} icon={place.is_active ? Check : X} />
                  <IconButton label="추천 토글" onClick={() => void togglePlace(place, "is_featured")} icon={Star} />
                  <IconButton label="비공개" onClick={() => void deleteSelected(place)} icon={Trash2} danger />
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="등록된 장소 없음" description="새 장소를 추가해 주세요." />
          )}
        </div>
      </aside>

      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">{form.id ? "장소 수정" : "장소 추가"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              현재 데이터 소스: {source === "supabase" ? "Supabase" : "Demo fallback"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetChinaInfoToUnknown}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
            >
              <RotateCcw size={17} aria-hidden="true" />
              중국 특화 확인 필요
            </button>
            <button
              type="button"
              onClick={() => void translateTextFields()}
              disabled={translating || saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Languages size={17} aria-hidden="true" />
              {translating ? "번역 중" : "AI 번역 채우기"}
            </button>
            <button
              type="button"
              onClick={() => void savePlace()}
              disabled={saving || geocoding}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} aria-hidden="true" />
              {saving ? "저장 중" : geocoding ? "좌표 검색 중" : "저장"}
            </button>
          </div>
        </div>

        {status ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <FormSection title="1. 기본 장소 정보">
              <Field label="지도 링크/source">
                <input value={form.source_url} onChange={(event) => updateField("source_url", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Provider">
                <select value={form.source_provider} onChange={(event) => updateField("source_provider", event.target.value as PlaceSourceProvider)} className={inputClass}>
                  {(["NAVER", "KAKAO", "GOOGLE", "MANUAL"] as const).map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="지도 장소 ID">
                <input value={form.source_external_id} onChange={(event) => updateField("source_external_id", event.target.value)} className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <AdminAiDraftPanel
                  draft={aiDraft}
                  generating={generatingAiDraft}
                  canApply={hasPlaceAiGeneratedContent(aiDraft?.generated_content)}
                  onGenerate={() => void prepareAiDraft()}
                  onApply={applyAiDraft}
                />
              </div>
              <Field label="URL 주소명">
                <input value={form.slug} onChange={(event) => updateField("slug", slugify(event.target.value))} className={inputClass} />
              </Field>
              <Field label="카테고리">
                <select value={form.category} onChange={(event) => updateField("category", event.target.value as PlaceCategory)} className={inputClass}>
                  {placeCategories.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category].ko}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="중국어 장소명">
                <input
                  value={form.name_zh}
                  onChange={(event) => {
                    updateField("name_zh", event.target.value);
                    if (!form.slug) {
                      updateField("slug", slugify(event.target.value));
                    }
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="한국어 장소명">
                <input value={form.name_ko} onChange={(event) => updateField("name_ko", event.target.value)} className={inputClass} />
              </Field>
              <Field label="영어 장소명">
                <input value={form.name_en} onChange={(event) => updateField("name_en", event.target.value)} className={inputClass} />
              </Field>
              <Field label="일본어 장소명">
                <input value={form.name_ja} onChange={(event) => updateField("name_ja", event.target.value)} className={inputClass} />
              </Field>
              <Field label="중국어 짧은 설명">
                <textarea value={form.short_description_zh} onChange={(event) => updateField("short_description_zh", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="한국어 짧은 설명">
                <textarea value={form.short_description_ko} onChange={(event) => updateField("short_description_ko", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="영어 짧은 설명">
                <textarea value={form.short_description_en} onChange={(event) => updateField("short_description_en", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="일본어 짧은 설명">
                <textarea value={form.short_description_ja} onChange={(event) => updateField("short_description_ja", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="한국어 주소">
                <input value={form.address_ko} onChange={(event) => updateField("address_ko", event.target.value)} className={inputClass} />
              </Field>
              <Field label="중국어 주소">
                <input value={form.address_zh} onChange={(event) => updateField("address_zh", event.target.value)} className={inputClass} />
              </Field>
              <div className="rounded-2xl bg-teal-50 p-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-teal-950">주소 자동 좌표 변환</p>
                    <p className="mt-1 text-xs font-semibold text-teal-700">한국어 주소를 우선 사용하고, 결과 좌표를 위도/경도에 채웁니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fillCoordinatesFromAddress()}
                    disabled={geocoding}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {geocoding ? "검색 중" : "주소로 좌표 찾기"}
                  </button>
                </div>
              </div>
              <Field label="위도">
                <input value={form.latitude} onChange={(event) => updateField("latitude", event.target.value)} className={inputClass} inputMode="decimal" />
              </Field>
              <Field label="경도">
                <input value={form.longitude} onChange={(event) => updateField("longitude", event.target.value)} className={inputClass} inputMode="decimal" />
              </Field>
              <Field label="가까운 역">
                <input value={form.nearest_station} onChange={(event) => updateField("nearest_station", event.target.value)} className={inputClass} />
              </Field>
              <Field label="출구">
                <input value={form.nearest_exit} onChange={(event) => updateField("nearest_exit", event.target.value)} className={inputClass} />
              </Field>
              <Field label="도보 시간(분)">
                <input value={form.walking_minutes} onChange={(event) => updateField("walking_minutes", event.target.value)} className={inputClass} inputMode="numeric" />
              </Field>
              <Field label="지하철 도보 시간(분)">
                <input
                  value={form.china_info.subway_walk_minutes}
                  onChange={(event) => updateChinaField("subway_walk_minutes", event.target.value)}
                  className={inputClass}
                  inputMode="numeric"
                />
              </Field>
              <Field label="최소 가격">
                <input value={form.price_min} onChange={(event) => updateField("price_min", event.target.value)} className={inputClass} inputMode="numeric" />
              </Field>
              <Field label="최대 가격">
                <input value={form.price_max} onChange={(event) => updateField("price_max", event.target.value)} className={inputClass} inputMode="numeric" />
              </Field>
              <Field label="운영시간">
                <input value={form.opening_hours} onChange={(event) => updateField("opening_hours", event.target.value)} className={inputClass} />
              </Field>
              <Field label="대표 이미지 URL">
                <input value={form.thumbnail_url} onChange={(event) => updateField("thumbnail_url", event.target.value)} className={inputClass} />
              </Field>
              <CheckField label="추천 장소" checked={form.is_featured} onChange={(checked) => updateField("is_featured", checked)} />
              <CheckField label="활성" checked={form.is_active} onChange={(checked) => updateField("is_active", checked)} />
            </FormSection>

            <FormSection title="2. 중국인 입맛 평가">
              <div className="space-y-4 sm:col-span-2">
                {ratingControls.map((control) => (
                  <RatingSelector
                    key={control.key}
                    label={control.title}
                    value={form.china_info[control.key]}
                    help={ratingHelp[control.key].values}
                    onChange={(value) => updateChinaField(control.key, value)}
                  />
                ))}
              </div>
            </FormSection>

            <FormSection title="3. 결제 및 이용 편의">
              {convenienceControls.map((control) => (
                <TriStateSelector
                  key={control.key}
                  label={control.label}
                  help={control.help}
                  value={form.china_info[control.key] as PlaceFactTristate}
                  onChange={(value) => updateChinaField(control.key, value)}
                />
              ))}
            </FormSection>

            <FormSection title="4. 웨이팅 및 예약">
              <SegmentedGroup
                label="웨이팅"
                value={form.china_info.waiting_level}
                options={waitingOptions.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(value) => updateWaiting(value as ChinaWaitingLevel)}
              />
              <SegmentedGroup
                label="최소주문"
                value={form.china_info.minimum_order_policy}
                options={minimumOrderOptions.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(value) => updateMinimumOrder(value as ChinaMinimumOrderPolicy)}
              />
              {form.china_info.minimum_order_policy === "other" ? (
                <Field label="최소주문 기타 설명">
                  <input
                    value={form.china_info.minimum_order_note ?? ""}
                    onChange={(event) => updateChinaField("minimum_order_note", event.target.value)}
                    className={inputClass}
                    placeholder="예: 고기 500g 이상 주문"
                  />
                </Field>
              ) : null}
              <Field label="예상 대기 최소(분)">
                <input
                  value={form.china_info.waiting_minutes_min}
                  onChange={(event) => updateChinaField("waiting_minutes_min", event.target.value)}
                  className={inputClass}
                  inputMode="numeric"
                />
              </Field>
              <Field label="예상 대기 최대(분)">
                <input
                  value={form.china_info.waiting_minutes_max}
                  onChange={(event) => updateChinaField("waiting_minutes_max", event.target.value)}
                  className={inputClass}
                  inputMode="numeric"
                />
              </Field>
            </FormSection>

            <FormSection title="5. Xiaohongshu/관광 포인트">
              {xiaohongshuControls.map((control) => (
                <TriStateSelector
                  key={control.key}
                  label={control.label}
                  help={control.help}
                  value={form.china_info[control.key] as PlaceFactTristate}
                  onChange={(value) => updateChinaField(control.key, value)}
                />
              ))}
            </FormSection>

            <FormSection title="7. 선택적 직접 수정">
              <Field label="중국인 대상 설명 직접 수정">
                <textarea
                  value={form.china_info.manual_summary_override ?? ""}
                  onChange={(event) => updateChinaField("manual_summary_override", event.target.value)}
                  className={textareaClass}
                  placeholder="비워두면 자동 생성 문장을 사용합니다."
                />
              </Field>
              <Field label="주의사항 직접 수정">
                <textarea
                  value={form.china_info.manual_warning_override ?? ""}
                  onChange={(event) => updateChinaField("manual_warning_override", event.target.value)}
                  className={textareaClass}
                  placeholder="비워두면 자동 경고만 사용합니다. 입력하면 가장 먼저 표시됩니다."
                />
              </Field>
              <Field label="추천 주문 중국어">
                <textarea value={form.recommended_order_zh} onChange={(event) => updateField("recommended_order_zh", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="추천 주문 한국어">
                <textarea value={form.recommended_order_ko} onChange={(event) => updateField("recommended_order_ko", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="여행 팁 중국어">
                <textarea value={form.tips_zh} onChange={(event) => updateField("tips_zh", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="여행 팁 한국어">
                <textarea value={form.tips_ko} onChange={(event) => updateField("tips_ko", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="여행 팁 영어">
                <textarea value={form.tips_en} onChange={(event) => updateField("tips_en", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="여행 팁 일본어">
                <textarea value={form.tips_ja} onChange={(event) => updateField("tips_ja", event.target.value)} className={textareaClass} />
              </Field>
              <Field label="태그">
                <textarea
                  value={form.tags_text}
                  onChange={(event) => updateField("tags_text", event.target.value)}
                  className={textareaClass}
                  placeholder="当地人常去 | 현지인이 자주 감 | local"
                />
              </Field>
            </FormSection>

            <FormSection title="메뉴 CRUD">
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={addMenu}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                >
                  <Plus size={16} aria-hidden="true" />
                  메뉴 추가
                </button>
                <div className="mt-3 space-y-3">
                  {form.menu_items.map((item, index) => (
                    <div key={`${index}-${item.name_ko}`} className="rounded-2xl bg-slate-50 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input placeholder="메뉴명 KO" value={item.name_ko} onChange={(event) => updateMenu(index, { name_ko: event.target.value })} className={inputClass} />
                        <input placeholder="메뉴명 ZH" value={item.name_zh} onChange={(event) => updateMenu(index, { name_zh: event.target.value })} className={inputClass} />
                        <input placeholder="가격" value={item.price} onChange={(event) => updateMenu(index, { price: event.target.value })} className={inputClass} inputMode="numeric" />
                        <input placeholder="정렬" value={item.sort_order} onChange={(event) => updateMenu(index, { sort_order: event.target.value })} className={inputClass} inputMode="numeric" />
                      </div>
                      <textarea
                        placeholder="중국어 메뉴 설명"
                        value={item.description_zh}
                        onChange={(event) => updateMenu(index, { description_zh: event.target.value })}
                        className={`${textareaClass} mt-3`}
                      />
                      <div className="mt-3 flex items-center justify-between">
                        <CheckField label="추천 메뉴" checked={item.is_recommended} onChange={(checked) => updateMenu(index, { is_recommended: checked })} />
                        <button type="button" onClick={() => removeMenu(index)} className="inline-flex items-center gap-1 text-sm font-semibold text-rose-700">
                          <Trash2 size={16} aria-hidden="true" />
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FormSection>
          </div>

          <section className="xl:sticky xl:top-24 xl:self-start">
            <ChinaPreview summary={preview} />
          </section>
        </div>
      </section>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[16px] text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";

const textareaClass =
  "min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[16px] text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-black text-slate-950">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-teal-700" />
      {label}
    </label>
  );
}

function RatingSelector({
  label,
  value,
  help,
  onChange,
}: {
  label: string;
  value: number | null;
  help: Record<number, { zh: string; ko: string }>;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-950">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{value ? `${value} = ${help[value].ko}` : "확인 필요"}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
          초기화
        </button>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {scoreOptions.map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={[
              "min-h-12 rounded-2xl px-2 text-center text-sm font-black ring-1 transition active:scale-95",
              value === score ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100",
            ].join(" ")}
            title={`${score} = ${help[score].ko}`}
          >
            <span className="block">{score}</span>
            <span className="block truncate text-[11px] font-semibold opacity-75">{help[score].zh}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TriStateSelector({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: PlaceFactTristate;
  onChange: (value: PlaceFactTristate) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-sm font-black text-slate-950">{label}</p>
      <p className="mt-1 min-h-4 text-xs text-slate-500">{help}</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[
          { value: "yes", label: "가능" },
          { value: "no", label: "불가능" },
          { value: "unknown", label: "확인 필요" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value as PlaceFactTristate)}
            className={[
              "h-10 rounded-2xl px-2 text-sm font-black ring-1 transition active:scale-95",
              value === option.value ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold text-teal-700">사용자 표시: {tristateLabel(value)}</p>
    </div>
  );
}

function SegmentedGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-2">
      <p className="text-sm font-black text-slate-950">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              "rounded-full px-3 py-2 text-sm font-black ring-1 transition active:scale-95",
              value === option.value ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
      {label === "웨이팅" ? <p className="mt-2 text-xs font-semibold text-teal-700">사용자 표시: {waitingLabel(value as ChinaWaitingLevel)}</p> : null}
    </div>
  );
}

function ChinaPreview({ summary }: { summary: ReturnType<typeof buildChinaPlaceSummary> }) {
  return (
    <section className="rounded-[24px] bg-slate-950 p-4 text-white shadow-sm">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold text-teal-100 ring-1 ring-white/10">
        <Eye size={16} aria-hidden="true" />
        6. 자동 생성 Preview
      </div>
      <h3 className="mt-4 text-lg font-black">사용자에게 이렇게 보입니다</h3>
      <p className="mt-3 text-sm leading-6 text-slate-100">{summary.summary}</p>

      <div className="mt-4 grid gap-2">
        {summary.ratings.map((rating) => (
          <div key={rating.key} className="rounded-2xl bg-white/8 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-300">{rating.label}</span>
              <span className="text-xs font-black text-white">{rating.value ? `${rating.value}/5` : "확인 필요"}</span>
            </div>
            <p className="mt-1 text-sm font-bold text-white">{rating.zhLabel}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {summary.tags.length ? summary.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>) : <TagChip tone="blue">信息确认中</TagChip>}
      </div>

      <div className="mt-4 rounded-2xl bg-white/8 p-3">
        <p className="text-xs font-bold text-slate-300">结算/便利</p>
        <p className="mt-2 text-sm leading-6">{summary.paymentSummary}</p>
        <p className="mt-1 text-sm leading-6">{summary.convenienceSummary}</p>
        <p className="mt-1 text-sm leading-6">{summary.waitingSummary}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-amber-300/12 p-3 ring-1 ring-amber-200/20">
        <p className="text-xs font-bold text-amber-100">去之前先看</p>
        {summary.warnings.length ? (
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-50">
            {summary.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-amber-50">暂无特别提醒</p>
        )}
      </div>

      {summary.unknownFacts.length ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-3">
          <p className="text-xs font-bold text-slate-300">暂未确认</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.unknownFacts.slice(0, 8).map((fact) => (
              <TagChip key={fact} tone="blue">
                {fact}
              </TagChip>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type IconButtonProps = {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  danger?: boolean;
};

function IconButton({ label, onClick, icon: Icon, danger = false }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "grid size-9 place-items-center rounded-full ring-1 transition active:scale-95",
        danger ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
