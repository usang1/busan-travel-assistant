"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { GuideEditorialFields } from "@/components/GuideEditorialFields";
import { guideCopy } from "@/lib/guide-copy";
import { emptyGuideText } from "@/lib/guide-validation";
import { isPublicPlace } from "@/lib/place-publishing";
import { guideTypes, type Guide, type GuideDetail, type GuidePayload, type GuideStop } from "@/types/guide";
import type { PlaceWithRelations } from "@/types/database";

const languageNames = { ko: "한국어", zh: "중국어", en: "영어", ja: "일본어" };
const languages = ["ko", "zh", "en", "ja"] as const;
const inputStyle = "mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950";
const buttonStyle = "min-h-11 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-40";
function freshGuide(): GuidePayload {
  return {
    slug: "", status: "DRAFT", guide_type: "AREA", title_ko: "", title_zh: "", title_en: "", title_ja: "",
    description_ko: "", description_zh: "", description_en: "", description_ja: "", cover_image: "", area: "",
    estimated_duration: null, recommended_for: emptyGuideText(), weather_type: "ANY", sort_order: 0, is_featured: false, places: [],
  };
}
type Draft = GuidePayload & { id?: string; updated_at?: string };
export function AdminGuideManager({ accessToken, places }: { accessToken: string; places: PlaceWithRelations[] }) {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`/api/admin/guides${path}`, {
      ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 204) return {};
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "가이드 요청에 실패했습니다.");
    return body;
  }, [accessToken]);
  const reload = useCallback(async () => {
    const body = await api("");
    setGuides(body.guides);
  }, [api]);
  useEffect(() => { void reload().catch((error) => setMessage(error.message)); }, [reload]);
  async function action(callback: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await callback(); } catch (error) { setMessage(error instanceof Error ? error.message : "요청에 실패했습니다."); }
    finally { setBusy(false); }
  }
  async function edit(id: string) {
    const { guide } = await api(`/${id}`) as { guide: GuideDetail };
    setDraft({ ...guide, places: [...guide.guide_places].sort((a, b) => a.sequence - b.sequence) });
    setDeleteId(null);
  }
  function update(patch: Partial<Draft>) { setDraft((current) => current ? { ...current, ...patch } : current); }
  function stopUpdate(index: number, patch: Partial<GuideStop>) {
    if (draft) update({ places: draft.places.map((stop, i) => i === index ? { ...stop, ...patch } : stop) });
  }
  function move(index: number, delta: number) {
    if (!draft) return;
    const stops = [...draft.places];
    [stops[index], stops[index + delta]] = [stops[index + delta], stops[index]];
    update({ places: stops.map((stop, sequence) => ({ ...stop, sequence })) });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    void action(async () => {
      const { id } = await api(draft.id ? `/${draft.id}` : "", { method: draft.id ? "PUT" : "POST", body: JSON.stringify(draft) });
      await edit(id); await reload(); setMessage("저장했습니다.");
    });
  }
  const candidates = places.filter((place) => !draft?.places.some((stop) => stop.place_id === place.id)
    && `${place.name_ko} ${place.name_zh} ${place.slug}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30);
  return (
    <section id="guides" className="min-w-0 space-y-5 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black">여행 가이드 / 여행 코스 관리</h2><p className="mt-1 text-sm text-slate-500">관리자 공식 콘텐츠 · 개인 여행 일정과 별도 관리</p></div>
        <button className={buttonStyle} disabled={busy} onClick={() => { setDraft(freshGuide()); setDeleteId(null); setMessage(""); }}>새 코스 생성</button>
      </div>
      <p role="status" className="whitespace-pre-wrap text-sm text-teal-800">{message}</p>
      <div className="space-y-2">
        {!guides.length ? <p className="text-sm text-slate-500">등록된 가이드가 없습니다.</p> : null}
        {guides.map((guide) => <div key={guide.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3">
          <div className="min-w-0"><p className="break-words font-bold">{guide.title_ko}</p><p className="text-xs text-slate-500">{guide.status === "PUBLISHED" ? "공개" : "비공개"} · {guideCopy.ko.types[guide.guide_type]}</p></div>
          <div className="flex flex-wrap gap-2">
            <button className={buttonStyle} disabled={busy} onClick={() => void action(() => edit(guide.id))}>수정</button>
            {guide.status === "PUBLISHED" ? <Link className={buttonStyle} href={`/ko/guides/${guide.slug}`}>공개 페이지</Link> : null}
            <button className={buttonStyle} disabled={busy} onClick={() => setDeleteId(guide.id)}>삭제</button>
          </div>
          {deleteId === guide.id ? <div className="flex w-full flex-wrap items-center gap-2 text-sm"><span>이 코스와 연결·저장 기록을 삭제할까요? 장소 원본은 유지됩니다.</span><button className={buttonStyle} disabled={busy} onClick={() => void action(async () => { await api(`/${guide.id}`, { method: "DELETE" }); if (draft?.id === guide.id) setDraft(null); setDeleteId(null); await reload(); setMessage("삭제했습니다."); })}>삭제 확인</button><button className={buttonStyle} onClick={() => setDeleteId(null)}>취소</button></div> : null}
        </div>)}
      </div>
      {draft ? <form onSubmit={submit} className="min-w-0 space-y-5 border-t border-slate-200 pt-5">
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-bold">공유 URL slug<input className={inputStyle} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={(e) => update({ slug: e.target.value })} /></label>
            <label className="text-sm font-bold">공개 상태<select className={inputStyle} value={draft.status} onChange={(e) => update({ status: e.target.value as Draft["status"] })}><option value="DRAFT">비공개</option><option value="PUBLISHED">공개</option></select></label>
            <label className="text-sm font-bold">코스 유형<select className={inputStyle} value={draft.guide_type} onChange={(e) => update({ guide_type: e.target.value as Draft["guide_type"] })}>{guideTypes.map((type) => <option key={type} value={type}>{guideCopy.ko.types[type]}</option>)}</select></label>
            <label className="text-sm font-bold">지역<input className={inputStyle} maxLength={100} value={draft.area} onChange={(e) => update({ area: e.target.value })} /></label>
            <label className="text-sm font-bold">소요시간 (분)<input type="number" min={0} max={43200} className={inputStyle} value={draft.estimated_duration ?? ""} onChange={(e) => update({ estimated_duration: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label className="text-sm font-bold">날씨<select className={inputStyle} value={draft.weather_type} onChange={(e) => update({ weather_type: e.target.value as Draft["weather_type"] })}>{Object.entries(guideCopy.ko.weatherTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm font-bold">정렬 순서<input className={inputStyle} type="number" min={0} max={100000} value={draft.sort_order} onChange={(e) => update({ sort_order: Number(e.target.value) })} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={draft.is_featured} onChange={(e) => update({ is_featured: e.target.checked })} />추천 가이드</label>
          </div>
          <label className="block text-sm font-bold">대표 이미지 HTTPS URL<input className={inputStyle} type="url" value={draft.cover_image} onChange={(e) => update({ cover_image: e.target.value })} /></label>
          <p className="text-sm text-slate-500">공개 전 네 언어의 제목과 설명을 모두 입력해주세요. 장소별 이동 메모는 해당 장소에서 다음 장소로 가는 안내입니다.</p>
          {languages.map((locale) => <details key={locale} open={locale === "ko"} className="min-w-0 rounded-2xl border border-slate-200 p-3">
            <summary className="cursor-pointer font-bold">{languageNames[locale]}</summary>
            <label className="mt-3 block text-sm">제목<input className={inputStyle} maxLength={200} value={draft[`title_${locale}`]} onChange={(e) => update({ [`title_${locale}`]: e.target.value })} /></label>
            <label className="mt-3 block text-sm">설명<textarea className={inputStyle} rows={4} maxLength={4000} value={draft[`description_${locale}`]} onChange={(e) => update({ [`description_${locale}`]: e.target.value })} /></label>
            <label className="mt-3 block text-sm">추천 대상<input className={inputStyle} value={draft.recommended_for[locale] ?? ""} onChange={(e) => update({ recommended_for: { ...draft.recommended_for, [locale]: e.target.value } })} /></label>
            <GuideEditorialFields value={draft.editorial?.[locale]} onChange={(entry) => update({ editorial: { ...draft.editorial, [locale]: entry } })} />
          </details>)}
          <div className="space-y-3"><h3 className="font-black">코스 장소 ({draft.places.length}/80)</h3>
            {draft.places.map((stop, index) => {
              const place = places.find((place) => place.id === stop.place_id);
              return <div key={stop.place_id} className="min-w-0 space-y-3 rounded-2xl bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="min-w-0 break-words font-bold">{index + 1}. {place?.name_ko ?? "장소 확인 필요"}{place && !isPublicPlace(place) ? " (비공개 장소)" : ""}</h4>
                  <div className="flex gap-1"><button type="button" className={buttonStyle} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${index + 1}번 장소 위로`}>↑</button><button type="button" className={buttonStyle} disabled={index === draft.places.length - 1} onClick={() => move(index, 1)} aria-label={`${index + 1}번 장소 아래로`}>↓</button><button type="button" className={buttonStyle} onClick={() => update({ places: draft.places.filter((_, i) => i !== index) })}>제거</button></div>
                </div>
                <label className="block text-sm">체류시간 (분)<input type="number" min={0} max={10080} className={inputStyle} value={stop.stay_minutes ?? ""} onChange={(e) => stopUpdate(index, { stay_minutes: e.target.value === "" ? null : Number(e.target.value) })} /></label>
                {languages.map((locale) => <details key={locale} className="min-w-0"><summary className="cursor-pointer text-sm font-bold">{languageNames[locale]} 장소 안내</summary>
                  {(["custom_title", "custom_description", "transportation_note", "tip"] as const).map((field) => <label key={field} className="mt-2 block text-sm">{{ custom_title: "장소별 제목", custom_description: "설명", transportation_note: "다음 장소 이동 메모", tip: "추천 팁" }[field]}<textarea rows={2} maxLength={4000} className={inputStyle} value={stop[field][locale] ?? ""} onChange={(e) => stopUpdate(index, { [field]: { ...stop[field], [locale]: e.target.value } })} /></label>)}
                </details>)}
              </div>;
            })}
            <label className="block text-sm font-bold">기존 장소 검색<input type="search" className={inputStyle} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <div className="max-h-64 space-y-2 overflow-y-auto">{candidates.map((place) => <button type="button" key={place.id} className={`${buttonStyle} w-full text-left`} disabled={draft.places.length >= 80} onClick={() => update({ places: [...draft.places, { place_id: place.id, sequence: draft.places.length, custom_title: emptyGuideText(), custom_description: emptyGuideText(), stay_minutes: null, transportation_note: emptyGuideText(), tip: emptyGuideText() }] })}>{place.name_ko} · {place.name_zh} {isPublicPlace(place) ? "추가" : "비공개 · 추가"}</button>)}</div>
          </div>
          <div className="flex flex-wrap gap-2"><button type="submit" className="min-h-11 rounded-xl bg-teal-700 px-5 py-2 font-bold text-white disabled:opacity-40">{busy ? "저장 중…" : "코스 저장"}</button><button type="button" className={buttonStyle} onClick={() => setDraft(null)}>편집 닫기</button></div>
        </fieldset>
      </form> : null}
    </section>
  );
}
