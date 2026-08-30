"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Languages, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { AdminAiDraftPanel } from "@/components/AdminAiDraftPanel";
import { buildAdminPlaceVisibilityNotice } from "@/lib/admin-place-visibility";
import { parseMapUrl } from "@/lib/map-url";
import { canUseNaverGeocoder, geocodeKoreanAddress } from "@/lib/naver-geocoder";
import { buildPlaceSourceData, hasPlaceAiGeneratedContent } from "@/lib/place-ai/content-draft";
import { categoryLabels, placeCategories, type PlaceCategory, type PlacePayload, type PlaceSourceProvider, type PlaceSubmissionRecord, type PlaceWithRelations, type SubmissionStatus } from "@/types/database";
import type { PlaceAiGeneratedContent, PlaceAiGenerationResponse } from "@/types/place-ai";

type AdminSubmissionWorkflowProps = {
  accessToken: string;
  onPlaceCreated: () => Promise<void>;
};

type TranslationDraft = {
  name: string;
  description: string;
  travel_tip: string;
};

type PayloadTranslation = NonNullable<PlacePayload["translations"]>[number];

type PublishForm = {
  source_url: string;
  provider: PlaceSourceProvider;
  source_external_id: string;
  slug: string;
  category: PlaceCategory;
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
  latitude: string;
  longitude: string;
  phone: string;
  website: string;
  opening_hours: string;
  price_level: string;
  price_min: string;
  price_max: string;
  tips_zh: string;
  tips_en: string;
  tips_ja: string;
  tips_ko: string;
  thumbnail_url: string;
  nearest_station: string;
  nearest_exit: string;
  walking_minutes: string;
  solo_friendly: boolean;
  luggage_friendly: boolean;
  chinese_menu: boolean;
  card_payment: boolean;
  is_active: boolean;
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

const defaultImage = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";
const statuses: SubmissionStatus[] = ["pending", "reviewing", "approved", "rejected", "duplicate"];
const statusLabels: Record<SubmissionStatus, string> = {
  pending: "대기",
  reviewing: "검토중",
  approved: "승인",
  rejected: "거절",
  duplicate: "중복",
};

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

function hasCoordinateInput(form: Pick<PublishForm, "latitude" | "longitude">) {
  return nullableNumber(form.latitude) !== null && nullableNumber(form.longitude) !== null;
}

function geocodeQueryFromPublishForm(form: Pick<PublishForm, "address_ko" | "address_zh" | "name_ko" | "name_zh">) {
  return [form.address_ko, form.address_zh, form.name_ko, form.name_zh].find((value) => value.trim())?.trim() ?? "";
}

function emptyForm(submission?: PlaceSubmissionRecord | null): PublishForm {
  const parsed = parseMapUrl(submission?.source_url ?? "");
  const baseName = submission?.name ?? "";
  const reason = submission?.recommendation_reason || submission?.notes || "";

  return {
    source_url: parsed.normalizedUrl,
    provider: parsed.provider,
    source_external_id: "",
    slug: slugify(baseName),
    category: submission?.category ?? "restaurant",
    name_zh: baseName,
    name_en: "",
    name_ja: "",
    name_ko: baseName,
    description_zh: reason,
    description_en: "",
    description_ja: "",
    description_ko: reason,
    address_ko: submission?.location_text ?? submission?.address_text ?? "",
    address_zh: submission?.location_text ?? submission?.address_text ?? "",
    latitude: "",
    longitude: "",
    phone: "",
    website: "",
    opening_hours: "",
    price_level: "",
    price_min: "",
    price_max: "",
    tips_zh: reason,
    tips_en: "",
    tips_ja: "",
    tips_ko: reason,
    thumbnail_url: defaultImage,
    nearest_station: "광안역",
    nearest_exit: "",
    walking_minutes: "8",
    solo_friendly: false,
    luggage_friendly: false,
    chinese_menu: false,
    card_payment: true,
    is_active: true,
  };
}

function buildPayload(form: PublishForm): PlacePayload {
  const zh: TranslationDraft = {
    name: form.name_zh,
    description: form.description_zh,
    travel_tip: form.tips_zh,
  };
  const ko: TranslationDraft = {
    name: form.name_ko,
    description: form.description_ko,
    travel_tip: form.tips_ko,
  };

  return {
    slug: form.slug || slugify(form.name_ko || form.name_zh),
    name_zh: form.name_zh || form.name_ko,
    name_ko: form.name_ko || form.name_zh,
    category: form.category,
    address: form.address_ko,
    phone: form.phone || null,
    website: form.website || null,
    price_level: nullableNumber(form.price_level),
    status: form.is_active ? "ACTIVE" : "DRAFT",
    short_description_zh: form.description_zh,
    short_description_ko: form.description_ko,
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
    solo_friendly: form.solo_friendly,
    luggage_friendly: form.luggage_friendly,
    chinese_menu: form.chinese_menu,
    card_payment: form.card_payment,
    recommended_order_zh: "",
    recommended_order_ko: "",
    tips_zh: form.tips_zh,
    tips_ko: form.tips_ko,
    thumbnail_url: form.thumbnail_url || defaultImage,
    is_featured: false,
    is_active: form.is_active,
    tags: [
      { label_zh: categoryLabels[form.category].zh, label_ko: categoryLabels[form.category].ko, slug: form.category },
    ],
    menu_items: [],
    translations: [
      { locale: "zh", ...zh },
      form.name_en ? { locale: "en" as const, name: form.name_en, description: form.description_en, travel_tip: form.tips_en } : null,
      form.name_ja ? { locale: "ja" as const, name: form.name_ja, description: form.description_ja, travel_tip: form.tips_ja } : null,
      { locale: "ko", ...ko },
    ].filter((translation): translation is PayloadTranslation => Boolean(translation)),
    source: form.source_url
      ? {
          provider: form.provider,
          source_url: form.source_url,
          external_id: form.source_external_id || null,
        }
      : undefined,
  };
}

function buildTranslationFieldsFromPublishForm(form: PublishForm): AdminTranslationFields {
  return {
    name_ko: form.name_ko,
    name_zh: form.name_zh,
    name_en: form.name_en,
    short_description_ko: form.description_ko,
    short_description_zh: form.description_zh,
    short_description_en: form.description_en,
    description_ko: form.description_ko,
    description_zh: form.description_zh,
    description_en: form.description_en,
    tips_ko: form.tips_ko,
    tips_zh: form.tips_zh,
    tips_en: form.tips_en,
    recommended_order_ko: "",
    recommended_order_zh: "",
    address_ko: form.address_ko,
    address_zh: form.address_zh,
  };
}

function applyTranslationsToPublishForm(form: PublishForm, translations: Partial<AdminTranslationFields>) {
  let filledCount = 0;
  const fill = (current: string, translated?: string) => {
    if (current.trim() || !translated?.trim()) {
      return current;
    }

    filledCount += 1;
    return translated.trim();
  };
  const nextForm: PublishForm = {
    ...form,
    name_ko: fill(form.name_ko, translations.name_ko),
    name_zh: fill(form.name_zh, translations.name_zh),
    name_en: fill(form.name_en, translations.name_en),
    description_ko: fill(form.description_ko, translations.description_ko || translations.short_description_ko),
    description_zh: fill(form.description_zh, translations.description_zh || translations.short_description_zh),
    description_en: fill(form.description_en, translations.description_en || translations.short_description_en),
    tips_ko: fill(form.tips_ko, translations.tips_ko),
    tips_zh: fill(form.tips_zh, translations.tips_zh),
    tips_en: fill(form.tips_en, translations.tips_en),
    address_ko: fill(form.address_ko, translations.address_ko),
    address_zh: fill(form.address_zh, translations.address_zh),
  };

  return { nextForm, filledCount };
}

function applyGeneratedContentToPublishForm(form: PublishForm, content: PlaceAiGeneratedContent): PublishForm {
  const fill = (current: string, generated: string) => current.trim() || generated;
  const tipText = [...content.traveler_tips, ...content.cautions].filter(Boolean).join(" ");

  return {
    ...form,
    description_ko: fill(form.description_ko, content.description_ko),
    description_zh: fill(form.description_zh, content.description_zh),
    description_en: fill(form.description_en, content.description_en),
    description_ja: fill(form.description_ja, content.description_ja),
    tips_ko: fill(form.tips_ko, content.description_ko || tipText),
    tips_zh: fill(form.tips_zh, content.description_zh || tipText),
    tips_en: fill(form.tips_en, content.description_en || tipText),
    tips_ja: fill(form.tips_ja, content.description_ja || tipText),
  };
}

export function AdminSubmissionWorkflow({ accessToken, onPlaceCreated }: AdminSubmissionWorkflowProps) {
  const [submissions, setSubmissions] = useState<PlaceSubmissionRecord[]>([]);
  const [activeStatus, setActiveStatus] = useState<SubmissionStatus>("pending");
  const [selected, setSelected] = useState<PlaceSubmissionRecord | null>(null);
  const [form, setForm] = useState<PublishForm>(() => emptyForm(null));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [generatingAiDraft, setGeneratingAiDraft] = useState(false);
  const [aiDraft, setAiDraft] = useState<PlaceAiGenerationResponse | null>(null);

  const visibleSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === activeStatus),
    [activeStatus, submissions],
  );

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
    setSelected(submission);
    setForm(emptyForm(submission));
    setAiDraft(null);
    setStatus("");
  }

  function startDirectCreate() {
    setSelected(null);
    setForm(emptyForm(null));
    setAiDraft(null);
    setStatus("제보 없이 직접 장소를 등록합니다. 지도 링크를 넣으면 provider만 식별합니다.");
  }

  function updateField<Key extends keyof PublishForm>(key: Key, value: PublishForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function resolveCoordinatesForPublishForm(currentForm: PublishForm) {
    const address = geocodeQueryFromPublishForm(currentForm);

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

  async function prepareAiDraft() {
    const payload = buildPayload(form);

    if (!payload.name_ko && !payload.name_zh) {
      setStatus("AI 생성 준비에는 장소명이 필요합니다.");
      return;
    }

    setGeneratingAiDraft(true);
    setStatus("여행자용 설명 생성 중입니다.");

    try {
      const response = await adminFetch("/api/admin/place-ai-generation", {
        method: "POST",
        body: JSON.stringify({
          source_data: buildPlaceSourceData(payload),
          locale_targets: ["ko", "zh", "en", "ja"],
          existing_content: {
            description_ko: form.description_ko,
            description_zh: form.description_zh,
            description_en: form.description_en,
            description_ja: form.description_ja,
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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI 생성 준비 중 오류가 발생했습니다.");
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
    setForm((current) => applyGeneratedContentToPublishForm(current, content));
    setStatus("AI 생성 결과를 입력 폼에 적용했습니다. DB 저장은 장소 등록 버튼을 눌러야 반영됩니다.");
  }

  async function parseSourceUrl() {
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

    setAnalyzing(true);
    setStatus("지도 링크를 분석하는 중입니다.");

    try {
      const response = await adminFetch("/api/admin/map-link", {
        method: "POST",
        body: JSON.stringify({ url: parsed.normalizedUrl }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "지도 링크 분석 실패");
      }

      const body = (await response.json()) as {
        analysis: {
          provider: PlaceSourceProvider;
          normalizedUrl: string;
          title?: string;
          latitude?: number;
          longitude?: number;
          externalId?: string;
        };
        summary?: {
          description_zh?: string;
          description_ko?: string;
          tips_zh?: string;
          tips_ko?: string;
        } | null;
        summaryError?: string;
        aiConfigured?: boolean;
      };
      const { analysis } = body;
      const summary = body.summary ?? null;
      const title = analysis.title?.trim() ?? "";

      setForm((current) => ({
        ...current,
        source_url: analysis.normalizedUrl,
        provider: analysis.provider,
        source_external_id: analysis.externalId ?? current.source_external_id,
        name_ko: current.name_ko || title,
        name_zh: current.name_zh || title,
        slug: current.slug || slugify(title),
        latitude: typeof analysis.latitude === "number" ? analysis.latitude.toFixed(7) : current.latitude,
        longitude: typeof analysis.longitude === "number" ? analysis.longitude.toFixed(7) : current.longitude,
        description_zh: current.description_zh || summary?.description_zh || "",
        description_ko: current.description_ko || summary?.description_ko || "",
        tips_zh: current.tips_zh || summary?.tips_zh || "",
        tips_ko: current.tips_ko || summary?.tips_ko || "",
      }));

      const filled = [
        title ? "장소명" : "",
        typeof analysis.latitude === "number" && typeof analysis.longitude === "number" ? "좌표" : "",
        analysis.externalId ? "네이버 ID" : "",
        summary ? "AI 설명" : "",
      ].filter(Boolean);
      const aiNotice = body.aiConfigured ? "" : " OpenAI API 키가 없어 설명 초안은 생성하지 않았습니다.";
      const aiErrorNotice = body.summaryError ? ` AI 설명 생성 실패: ${body.summaryError}` : "";
      setStatus(
        filled.length
          ? `지도 링크 분석 완료: ${filled.join(", ")}를 채웠습니다.${aiNotice}${aiErrorNotice}`
          : `provider만 확인했습니다. 장소명과 좌표는 직접 입력해 주세요.${aiNotice}${aiErrorNotice}`,
      );
    } catch (error) {
      setForm((current) => ({
        ...current,
        source_url: parsed.normalizedUrl,
        provider: parsed.provider,
      }));
      setStatus(error instanceof Error ? error.message : "지도 링크 분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
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
      const body = (await response.json()) as { translations?: Partial<AdminTranslationFields>; message?: string };

      if (!response.ok) {
        throw new Error(body.message ?? "AI 번역에 실패했습니다.");
      }

      const { nextForm, filledCount } = applyTranslationsToPublishForm(form, body.translations ?? {});
      setForm(nextForm);
      setStatus(filledCount > 0 ? `AI 번역으로 빈칸 ${filledCount}개를 채웠습니다.` : "이미 입력된 값은 유지했습니다. 채울 빈칸이 없습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI 번역 중 오류가 발생했습니다.");
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

    if (
      !(formToPublish.slug || slugify(formToPublish.name_ko || formToPublish.name_zh)) ||
      !formToPublish.name_zh ||
      !formToPublish.name_ko ||
      !formToPublish.description_zh ||
      !formToPublish.description_ko
    ) {
      setStatus("slug, 중국어/한국어 이름과 설명은 필수입니다.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      if (!hasCoordinateInput(formToPublish) && geocodeQueryFromPublishForm(formToPublish) && canUseNaverGeocoder()) {
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

      const payload = buildPayload(formToPublish);
      const endpoint = selected ? `/api/admin/submissions/${selected.id}/approve` : "/api/admin/places";
      const response = await adminFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "장소 등록 실패");
      }

      const body = (await response.json()) as { place?: PlaceWithRelations };
      await loadSubmissions();
      await onPlaceCreated();
      const visibilityNotice = body.place ? ` ${buildAdminPlaceVisibilityNotice(body.place)}` : "";
      setStatus(selected ? `장소 등록과 제보 승인이 완료되었습니다.${visibilityNotice}` : `장소를 직접 등록했습니다.${visibilityNotice}`);
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
                  <p className="mt-1 text-sm text-slate-500">제보자: {selected.user_id ?? "unknown"} · {new Date(selected.created_at).toLocaleString("ko-KR")}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">{statusLabels[selected.status]}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{selected.recommendation_reason || selected.notes}</p>
              {selected.source_url ? (
                <a href={selected.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-teal-700">
                  원본 지도 링크
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
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
            onParseSourceUrl={() => void parseSourceUrl()}
            onPublish={() => void publishPlace()}
            analyzing={analyzing}
            geocoding={geocoding}
            translating={translating}
            aiDraft={aiDraft}
            generatingAiDraft={generatingAiDraft}
            onGeocode={() => void fillCoordinatesFromAddress()}
            onPrepareAiDraft={() => void prepareAiDraft()}
            onApplyAiDraft={applyAiDraft}
            onTranslate={() => void translateTextFields()}
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
  onParseSourceUrl,
  onPublish,
  analyzing,
  geocoding,
  translating,
  aiDraft,
  generatingAiDraft,
  onGeocode,
  onPrepareAiDraft,
  onApplyAiDraft,
  onTranslate,
}: {
  form: PublishForm;
  saving: boolean;
  selected: PlaceSubmissionRecord | null;
  onFieldChange: <Key extends keyof PublishForm>(key: Key, value: PublishForm[Key]) => void;
  onParseSourceUrl: () => void;
  onPublish: () => void;
  analyzing: boolean;
  geocoding: boolean;
  translating: boolean;
  aiDraft: PlaceAiGenerationResponse | null;
  generatingAiDraft: boolean;
  onGeocode: () => void;
  onPrepareAiDraft: () => void;
  onApplyAiDraft: () => void;
  onTranslate: () => void;
}) {
  return (
    <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{selected ? "제보 기반 최종 장소 등록" : "관리자 직접 장소 등록"}</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onTranslate} disabled={translating || saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-50 px-4 text-sm font-black text-blue-800 ring-1 ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60">
            <Languages size={16} aria-hidden="true" />
            {translating ? "번역 중" : "AI 번역"}
          </button>
          <button type="button" onClick={onPublish} disabled={saving || geocoding} className="inline-flex h-10 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-60">
            <Send size={16} aria-hidden="true" />
            {saving ? "저장 중" : geocoding ? "좌표 검색 중" : "장소 등록"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="지도 링크/source">
          <div className="flex gap-2">
            <input value={form.source_url} onChange={(event) => onFieldChange("source_url", event.target.value)} className={inputClass} />
            <button type="button" onClick={onParseSourceUrl} disabled={analyzing} className="shrink-0 rounded-2xl bg-slate-950 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
              {analyzing ? "분석 중" : "분석"}
            </button>
          </div>
        </Field>
        <Field label="Provider">
          <select value={form.provider} onChange={(event) => onFieldChange("provider", event.target.value as PlaceSourceProvider)} className={inputClass}>
            {(["NAVER", "KAKAO", "GOOGLE", "MANUAL"] as const).map((provider) => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <AdminAiDraftPanel
            draft={aiDraft}
            generating={generatingAiDraft}
            canApply={hasPlaceAiGeneratedContent(aiDraft?.generated_content)}
            onGenerate={onPrepareAiDraft}
            onApply={onApplyAiDraft}
          />
        </div>
        <Field label="지도 장소 ID"><input value={form.source_external_id} onChange={(event) => onFieldChange("source_external_id", event.target.value)} className={inputClass} /></Field>
        <Field label="URL 주소명"><input value={form.slug} onChange={(event) => onFieldChange("slug", slugify(event.target.value))} className={inputClass} /></Field>
        <Field label="카테고리">
          <select value={form.category} onChange={(event) => onFieldChange("category", event.target.value as PlaceCategory)} className={inputClass}>
            {placeCategories.map((category) => <option key={category} value={category}>{categoryLabels[category].ko}</option>)}
          </select>
        </Field>
        <Field label="중국어명"><input value={form.name_zh} onChange={(event) => onFieldChange("name_zh", event.target.value)} className={inputClass} /></Field>
        <Field label="한국어명"><input value={form.name_ko} onChange={(event) => onFieldChange("name_ko", event.target.value)} className={inputClass} /></Field>
        <Field label="영어명"><input value={form.name_en} onChange={(event) => onFieldChange("name_en", event.target.value)} className={inputClass} /></Field>
        <Field label="일본어명"><input value={form.name_ja} onChange={(event) => onFieldChange("name_ja", event.target.value)} className={inputClass} /></Field>
        <Field label="중국어 설명"><textarea value={form.description_zh} onChange={(event) => onFieldChange("description_zh", event.target.value)} className={textareaClass} /></Field>
        <Field label="한국어 설명"><textarea value={form.description_ko} onChange={(event) => onFieldChange("description_ko", event.target.value)} className={textareaClass} /></Field>
        <Field label="영어 설명"><textarea value={form.description_en} onChange={(event) => onFieldChange("description_en", event.target.value)} className={textareaClass} /></Field>
        <Field label="일본어 설명"><textarea value={form.description_ja} onChange={(event) => onFieldChange("description_ja", event.target.value)} className={textareaClass} /></Field>
        <Field label="한국어 주소"><input value={form.address_ko} onChange={(event) => onFieldChange("address_ko", event.target.value)} className={inputClass} /></Field>
        <Field label="중국어 주소"><input value={form.address_zh} onChange={(event) => onFieldChange("address_zh", event.target.value)} className={inputClass} /></Field>
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
        <Field label="가격대(0-4)"><input value={form.price_level} onChange={(event) => onFieldChange("price_level", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="최소 가격"><input value={form.price_min} onChange={(event) => onFieldChange("price_min", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="최대 가격"><input value={form.price_max} onChange={(event) => onFieldChange("price_max", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="가까운 역"><input value={form.nearest_station} onChange={(event) => onFieldChange("nearest_station", event.target.value)} className={inputClass} /></Field>
        <Field label="출구"><input value={form.nearest_exit} onChange={(event) => onFieldChange("nearest_exit", event.target.value)} className={inputClass} /></Field>
        <Field label="도보 시간"><input value={form.walking_minutes} onChange={(event) => onFieldChange("walking_minutes", event.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="대표 이미지"><input value={form.thumbnail_url} onChange={(event) => onFieldChange("thumbnail_url", event.target.value)} className={inputClass} /></Field>
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
        <CheckField label="즉시 공개" checked={form.is_active} onChange={(checked) => onFieldChange("is_active", checked)} />
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">네이버 지도 짧은 링크는 가능한 경우 장소명, 좌표, 지도 장소 ID를 자동으로 채웁니다. OpenAI API 키가 설정되어 있으면 중국어/한국어 설명 초안도 비어 있는 입력란에 채웁니다.</p>
    </section>
  );
}

const inputClass = "h-11 w-full rounded-2xl bg-slate-50 px-3 text-sm text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-teal-200";
const textareaClass = "min-h-24 w-full rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-teal-200";

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
