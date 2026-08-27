"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, Pencil, Plus, Save, Star, Trash2, X, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { categoryLabels, placeCategories, type PlaceCategory, type PlacePayload, type PlaceWithRelations } from "@/types/database";

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
  waiting_info_zh: string;
  waiting_info_ko: string;
  solo_friendly: boolean;
  luggage_friendly: boolean;
  chinese_menu: boolean;
  card_payment: boolean;
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
};

const localStorageKey = "busan-travel-assistant-admin-places";
const defaultImage = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";

function createEmptyForm(): FormState {
  return {
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
    waiting_info_zh: "",
    waiting_info_ko: "",
    solo_friendly: false,
    luggage_friendly: false,
    chinese_menu: false,
    card_payment: true,
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

  return {
    id: place.id,
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
    waiting_info_zh: place.waiting_info_zh,
    waiting_info_ko: place.waiting_info_ko,
    solo_friendly: place.solo_friendly,
    luggage_friendly: place.luggage_friendly,
    chinese_menu: place.chinese_menu,
    card_payment: place.card_payment,
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
    waiting_info_zh: form.waiting_info_zh,
    waiting_info_ko: form.waiting_info_ko,
    solo_friendly: form.solo_friendly,
    luggage_friendly: form.luggage_friendly,
    chinese_menu: form.chinese_menu,
    card_payment: form.card_payment,
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
  };
}

function localPlaceFromPayload(payload: PlacePayload, id?: string): PlaceWithRelations {
  const placeId = id ?? `local-${Date.now()}`;
  const now = new Date().toISOString();
  const { translations, source, ...placePayload } = payload;
  void translations;
  void source;

  return {
    ...placePayload,
    id: placeId,
    created_at: now,
    updated_at: now,
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

export function AdminPlaceManager({ initialPlaces, source, error, supabaseConfigured, adminAccessToken }: AdminPlaceManagerProps) {
  const [places, setPlaces] = useState(initialPlaces);
  const [form, setForm] = useState<FormState>(() => (initialPlaces[0] ? toForm(initialPlaces[0]) : createEmptyForm()));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(error ?? "");

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

  async function savePlace(nextForm = form) {
    const payload = toPayload(nextForm);

    if (!payload.name_zh || !payload.name_ko || !payload.slug) {
      setStatus("중국어 이름, 한국어 이름, slug는 필수입니다.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      if (!supabaseConfigured) {
        const localPlace = localPlaceFromPayload(payload, nextForm.id);
        const nextPlaces = nextForm.id
          ? places.map((place) => (place.id === nextForm.id ? localPlace : place))
          : [localPlace, ...places];
        persistLocal(nextPlaces);
        setForm(toForm(localPlace));
        setStatus("Supabase 미설정 상태라 브라우저 demo 저장소에 저장했습니다.");
        return;
      }

      const response = await fetch(nextForm.id ? `/api/admin/places/${nextForm.id}` : "/api/admin/places", {
        method: nextForm.id ? "PUT" : "POST",
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
        nextForm.id ? current.map((place) => (place.id === savedPlace.id ? savedPlace : place)) : [savedPlace, ...current],
      );
      setForm(toForm(savedPlace));
      setStatus("저장했습니다. 사용자 /places 화면에 즉시 반영됩니다.");
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : "저장 중 오류가 발생했습니다.");
    } finally {
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
          onClick={() => setForm(createEmptyForm())}
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
                <button type="button" onClick={() => setForm(toForm(place))} className="block w-full text-left">
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
                  <IconButton label="수정" onClick={() => setForm(toForm(place))} icon={Pencil} />
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
          <button
            type="button"
            onClick={() => void savePlace()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} aria-hidden="true" />
            {saving ? "저장 중" : "저장"}
          </button>
        </div>

        {status ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{status}</p> : null}

        <div className="mt-6 space-y-7">
          <FormSection title="기본정보">
            <Field label="Slug">
              <input value={form.slug} onChange={(event) => updateField("slug", slugify(event.target.value))} className={inputClass} />
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
            <Field label="영어 장소명">
              <input value={form.name_en} onChange={(event) => updateField("name_en", event.target.value)} className={inputClass} />
            </Field>
            <Field label="일본어 장소명">
              <input value={form.name_ja} onChange={(event) => updateField("name_ja", event.target.value)} className={inputClass} />
            </Field>
            <Field label="한국어 장소명">
              <input value={form.name_ko} onChange={(event) => updateField("name_ko", event.target.value)} className={inputClass} />
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
            <Field label="중국어 짧은 설명">
              <textarea value={form.short_description_zh} onChange={(event) => updateField("short_description_zh", event.target.value)} className={textareaClass} />
            </Field>
            <Field label="영어 짧은 설명">
              <textarea value={form.short_description_en} onChange={(event) => updateField("short_description_en", event.target.value)} className={textareaClass} />
            </Field>
            <Field label="일본어 짧은 설명">
              <textarea value={form.short_description_ja} onChange={(event) => updateField("short_description_ja", event.target.value)} className={textareaClass} />
            </Field>
            <Field label="한국어 짧은 설명">
              <textarea value={form.short_description_ko} onChange={(event) => updateField("short_description_ko", event.target.value)} className={textareaClass} />
            </Field>
          </FormSection>

          <FormSection title="위치">
            <Field label="한국어 주소">
              <input value={form.address_ko} onChange={(event) => updateField("address_ko", event.target.value)} className={inputClass} />
            </Field>
            <Field label="중국어 주소">
              <input value={form.address_zh} onChange={(event) => updateField("address_zh", event.target.value)} className={inputClass} />
            </Field>
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
          </FormSection>

          <FormSection title="가격 / 운영시간">
            <Field label="최소 가격">
              <input value={form.price_min} onChange={(event) => updateField("price_min", event.target.value)} className={inputClass} inputMode="numeric" />
            </Field>
            <Field label="최대 가격">
              <input value={form.price_max} onChange={(event) => updateField("price_max", event.target.value)} className={inputClass} inputMode="numeric" />
            </Field>
            <Field label="운영시간">
              <input value={form.opening_hours} onChange={(event) => updateField("opening_hours", event.target.value)} className={inputClass} />
            </Field>
          </FormSection>

          <FormSection title="시설">
            <CheckField label="혼자 가능" checked={form.solo_friendly} onChange={(checked) => updateField("solo_friendly", checked)} />
            <CheckField label="캐리어 가능" checked={form.luggage_friendly} onChange={(checked) => updateField("luggage_friendly", checked)} />
            <CheckField label="중국어 메뉴" checked={form.chinese_menu} onChange={(checked) => updateField("chinese_menu", checked)} />
            <CheckField label="카드 결제" checked={form.card_payment} onChange={(checked) => updateField("card_payment", checked)} />
            <CheckField label="추천 장소" checked={form.is_featured} onChange={(checked) => updateField("is_featured", checked)} />
            <CheckField label="활성" checked={form.is_active} onChange={(checked) => updateField("is_active", checked)} />
          </FormSection>

          <FormSection title="중국인 관광객용 안내">
            <Field label="웨이팅 안내 중국어">
              <textarea value={form.waiting_info_zh} onChange={(event) => updateField("waiting_info_zh", event.target.value)} className={textareaClass} />
            </Field>
            <Field label="웨이팅 안내 한국어">
              <textarea value={form.waiting_info_ko} onChange={(event) => updateField("waiting_info_ko", event.target.value)} className={textareaClass} />
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
            <Field label="여행 팁 영어">
              <textarea value={form.tips_en} onChange={(event) => updateField("tips_en", event.target.value)} className={textareaClass} />
            </Field>
            <Field label="여행 팁 일본어">
              <textarea value={form.tips_ja} onChange={(event) => updateField("tips_ja", event.target.value)} className={textareaClass} />
            </Field>
            <Field label="여행 팁 한국어">
              <textarea value={form.tips_ko} onChange={(event) => updateField("tips_ko", event.target.value)} className={textareaClass} />
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

          <FormSection title="사진">
            <Field label="대표 이미지 URL">
              <input value={form.thumbnail_url} onChange={(event) => updateField("thumbnail_url", event.target.value)} className={inputClass} />
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
