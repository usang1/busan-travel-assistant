"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { parseMapUrl } from "@/lib/map-url";
import { categoryLabels, placeCategories, type PlaceCategory, type PlacePayload, type PlaceSourceProvider, type PlaceSubmissionRecord, type SubmissionStatus } from "@/types/database";

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

function emptyForm(submission?: PlaceSubmissionRecord | null): PublishForm {
  const parsed = parseMapUrl(submission?.source_url ?? "");
  const baseName = submission?.name ?? "";
  const reason = submission?.recommendation_reason || submission?.notes || "";

  return {
    source_url: parsed.normalizedUrl,
    provider: parsed.provider,
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
        }
      : undefined,
  };
}

export function AdminSubmissionWorkflow({ accessToken, onPlaceCreated }: AdminSubmissionWorkflowProps) {
  const [submissions, setSubmissions] = useState<PlaceSubmissionRecord[]>([]);
  const [activeStatus, setActiveStatus] = useState<SubmissionStatus>("pending");
  const [selected, setSelected] = useState<PlaceSubmissionRecord | null>(null);
  const [form, setForm] = useState<PublishForm>(() => emptyForm(null));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

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
    setStatus("");
  }

  function startDirectCreate() {
    setSelected(null);
    setForm(emptyForm(null));
    setStatus("제보 없이 직접 장소를 등록합니다. 지도 링크를 넣으면 provider만 식별합니다.");
  }

  function updateField<Key extends keyof PublishForm>(key: Key, value: PublishForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function parseSourceUrl() {
    const parsed = parseMapUrl(form.source_url);
    setForm((current) => ({
      ...current,
      source_url: parsed.normalizedUrl,
      provider: parsed.provider,
    }));
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
    const payload = buildPayload(form);

    if (!payload.slug || !payload.name_zh || !payload.name_ko || !payload.short_description_zh || !payload.short_description_ko) {
      setStatus("slug, 중국어/한국어 이름과 설명은 필수입니다.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const endpoint = selected ? `/api/admin/submissions/${selected.id}/approve` : "/api/admin/places";
      const response = await adminFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "장소 등록 실패");
      }

      await loadSubmissions();
      await onPlaceCreated();
      setStatus(selected ? "장소 등록과 제보 승인이 완료되었습니다." : "장소를 직접 등록했습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "장소 등록 중 오류가 발생했습니다.");
    } finally {
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
            onParseSourceUrl={parseSourceUrl}
            onPublish={() => void publishPlace()}
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
}: {
  form: PublishForm;
  saving: boolean;
  selected: PlaceSubmissionRecord | null;
  onFieldChange: <Key extends keyof PublishForm>(key: Key, value: PublishForm[Key]) => void;
  onParseSourceUrl: () => void;
  onPublish: () => void;
}) {
  return (
    <section className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{selected ? "제보 기반 최종 장소 등록" : "관리자 직접 장소 등록"}</h3>
        <button type="button" onClick={onPublish} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-60">
          <Send size={16} aria-hidden="true" />
          {saving ? "저장 중" : "장소 등록"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="지도 링크/source">
          <div className="flex gap-2">
            <input value={form.source_url} onChange={(event) => onFieldChange("source_url", event.target.value)} className={inputClass} />
            <button type="button" onClick={onParseSourceUrl} className="shrink-0 rounded-2xl bg-slate-950 px-3 text-sm font-black text-white">
              분석
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
        <Field label="Slug"><input value={form.slug} onChange={(event) => onFieldChange("slug", slugify(event.target.value))} className={inputClass} /></Field>
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
      <p className="mt-4 text-xs leading-5 text-slate-500">지도 링크는 provider 식별과 source 저장에만 사용합니다. 지원하지 않는 장소 데이터는 자동 생성하지 않습니다.</p>
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
