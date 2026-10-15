"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ClipboardCheck, MapPinCheck, RefreshCw } from "lucide-react";
import { AdminPlaceImageUpload } from "@/components/AdminPlaceImageUpload";
import {
  fieldVerificationStage,
  managedPlaceFields,
  placeFieldLabels,
  placeVerificationStatuses,
  type ManagedPlaceField,
  type PlaceFieldSourceType,
  type PlaceFieldVerificationStatus,
  type PlaceVerificationApproval,
} from "@/lib/place-field-verification";

type FieldRow = {
  id: string;
  field_name: ManagedPlaceField;
  current_value: unknown;
  original_value: unknown;
  source_type: PlaceFieldSourceType;
  source_url: string | null;
  verification_status: PlaceFieldVerificationStatus;
  effective_status?: PlaceFieldVerificationStatus;
  expires_at?: string | null;
  approval_status: PlaceVerificationApproval;
  verified_at: string | null;
  visit_id: string | null;
  private_notes: string | null;
  has_conflict: boolean;
  conflicting_value: unknown;
  is_public: boolean;
};

type VisitRow = { id: string; visited_on: string; actual_visit: boolean; checked_fields: string[]; overall_assessment: string | null };
type RuleRow = { field_name: string; stale_after_days: number; enabled: boolean };
type VerificationResponse = { fields: FieldRow[]; visits: VisitRow[]; rules: RuleRow[]; history: Array<{ id: number; field_name: string; changed_at: string }> };

type Snapshot = {
  provider: string;
  externalId?: string;
  sourceUrl?: string;
  collectedAt?: string;
  fields: Partial<Record<ManagedPlaceField, unknown>>;
};

type FieldDraft = {
  currentValue: string;
  sourceType: PlaceFieldSourceType;
  sourceUrl: string;
  verificationStatus: PlaceFieldVerificationStatus;
  approvalStatus: PlaceVerificationApproval;
  verifiedAt: string;
  visitId: string;
  privateNotes: string;
  isPublic: boolean;
};

const sourceOptions: Array<{ value: PlaceFieldSourceType; label: string }> = [
  { value: "map_api", label: "지도·장소 API" }, { value: "official_website", label: "공식 홈페이지" },
  { value: "official_menu", label: "공식 메뉴판" }, { value: "owner", label: "사업자 제공" },
  { value: "admin", label: "관리자 확인" }, { value: "field_visit", label: "직접 방문" },
  { value: "csv", label: "CSV 입력" }, { value: "manual", label: "수동 입력" },
];

export function AdminPlaceVerificationManager({ placeId, accessToken, snapshot }: { placeId: string; accessToken: string; snapshot: Snapshot }) {
  const [data, setData] = useState<VerificationResponse | null>(null);
  const [activeStage, setActiveStage] = useState(1);
  const [selectedField, setSelectedField] = useState<ManagedPlaceField>("address");
  const [draft, setDraft] = useState<FieldDraft>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [visit, setVisit] = useState({ visitedOn: new Date().toISOString().slice(0, 10), actualVisit: false, visitedMenu: "", checkedFields: [] as ManagedPlaceField[], advantages: "", disadvantages: "", overallAssessment: "", privateNotes: "", photos: [] as string[] });

  const request = useCallback(async (body?: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/places/${placeId}/verifications`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json() as VerificationResponse & { message?: string };
    if (!response.ok) throw new Error(result.message ?? "검증 정보를 처리하지 못했습니다.");
    return result;
  }, [accessToken, placeId]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await request()); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "검증 정보를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => new Map((data?.fields ?? []).map((row) => [row.field_name, row])), [data]);
  const stageFields = managedPlaceFields.filter((field) => {
    const row = rows.get(field);
    return row ? fieldVerificationStage(row.effective_status ?? row.verification_status) === activeStage : activeStage === 1;
  });

  function editField(field: ManagedPlaceField) {
    setSelectedField(field);
    const row = rows.get(field);
    setDraft(row ? {
      currentValue: stringifyValue(row.current_value), sourceType: row.source_type,
      sourceUrl: row.source_url ?? "", verificationStatus: row.verification_status,
      approvalStatus: row.approval_status, verifiedAt: row.verified_at?.slice(0, 10) ?? "",
      visitId: row.visit_id ?? "", privateNotes: row.private_notes ?? "", isPublic: row.is_public,
    } : { ...emptyDraft(), currentValue: stringifyValue(snapshot.fields[field]) });
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setSaving(true); setMessage("");
    try { await action(); setMessage(success); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  function bootstrap() {
    const fields = Object.entries(snapshot.fields).filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== "").map(([fieldName, value]) => ({ fieldName, value }));
    void run(() => request({ action: "bootstrap_auto", provider: snapshot.provider, externalId: snapshot.externalId, sourceUrl: snapshot.sourceUrl, collectedAt: snapshot.collectedAt, fields }), `${fields.length}개 자동 수집값을 검토 대기 상태로 기록했습니다.`);
  }

  function saveField() {
    const value = parseValue(draft.currentValue);
    const { currentValue: _currentValue, ...metadata } = draft;
    void _currentValue;
    void run(() => request({ action: "upsert_field", fieldName: selectedField, currentValue: value, ...metadata }), `${placeFieldLabels[selectedField]} 검증 상태를 저장했습니다.`);
  }

  function createVisit() {
    void run(() => request({ action: "create_visit", ...visit }), "현장 방문 기록을 저장했습니다. 확인한 항목은 방문 기록과 연결해 별도로 승인해 주세요.");
    setVisit((current) => ({ ...current, visitedMenu: "", checkedFields: [], advantages: "", disadvantages: "", overallAssessment: "", privateNotes: "", photos: [] }));
  }

  if (loading && !data) return <section className="rounded-3xl bg-slate-50 p-5 text-sm font-semibold text-slate-600">필드별 검증 정보를 불러오는 중입니다.</section>;

  return (
    <section className="rounded-[24px] bg-[#f6f3ec] p-4 ring-1 ring-[#e5dfd3] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">3단계 검증</p><h3 className="mt-1 text-lg font-black text-slate-950">정보별 출처와 확인 상태</h3><p className="mt-1 text-sm leading-6 text-slate-600">장소 전체가 아닌 각 정보에만 검증 상태가 적용됩니다. 승인된 항목만 사용자 화면에 표시됩니다.</p></div>
        <button type="button" onClick={bootstrap} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-50"><RefreshCw size={16} />현재 자동 수집값 기록</button>
      </div>
      {message ? <p role="status" className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">{message}</p> : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { stage: 1, icon: RefreshCw, label: "1. 자동 수집" },
          { stage: 2, icon: ClipboardCheck, label: "2. 온라인·사업자" },
          { stage: 3, icon: MapPinCheck, label: "3. 현장 검증" },
        ].map(({ stage, icon: Icon, label }) => <button key={stage} type="button" onClick={() => setActiveStage(stage)} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-2 text-xs font-black ring-1 sm:text-sm ${activeStage === stage ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"}`}><Icon size={16} />{label}</button>)}
      </div>

      {activeStage === 3 ? (
        <div className="mt-5 grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
          <Field label="방문 날짜"><input type="date" value={visit.visitedOn} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setVisit({ ...visit, visitedOn: event.target.value })} className={inputClass} /></Field>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-teal-50 px-4 text-sm font-black text-teal-900"><input type="checkbox" checked={visit.actualVisit} onChange={(event) => setVisit({ ...visit, actualVisit: event.target.checked })} />실제 방문함</label>
          <Field label="방문한 메뉴"><input value={visit.visitedMenu} onChange={(event) => setVisit({ ...visit, visitedMenu: event.target.value })} className={inputClass} /></Field>
          <Field label="종합 평가"><textarea value={visit.overallAssessment} onChange={(event) => setVisit({ ...visit, overallAssessment: event.target.value })} className={textareaClass} /></Field>
          <Field label="장점"><textarea value={visit.advantages} onChange={(event) => setVisit({ ...visit, advantages: event.target.value })} className={textareaClass} /></Field>
          <Field label="단점"><textarea value={visit.disadvantages} onChange={(event) => setVisit({ ...visit, disadvantages: event.target.value })} className={textareaClass} /></Field>
          <div className="sm:col-span-2"><p className="mb-2 text-sm font-black text-slate-800">현장에서 확인한 항목</p><div className="flex flex-wrap gap-2">{managedPlaceFields.map((field) => <label key={field} className="flex min-h-10 items-center gap-2 rounded-full bg-slate-50 px-3 text-xs font-bold ring-1 ring-slate-200"><input type="checkbox" checked={visit.checkedFields.includes(field)} onChange={(event) => setVisit({ ...visit, checkedFields: event.target.checked ? [...visit.checkedFields, field] : visit.checkedFields.filter((value) => value !== field) })} />{placeFieldLabels[field]}</label>)}</div></div>
          <Field label="현장 사진"><AdminPlaceImageUpload accessToken={accessToken} value={visit.photos[0] ?? ""} onChange={(url) => setVisit({ ...visit, photos: url ? [url] : [] })} /></Field>
          <Field label="비공개 관리자 메모"><textarea value={visit.privateNotes} onChange={(event) => setVisit({ ...visit, privateNotes: event.target.value })} className={textareaClass} /></Field>
          <button type="button" disabled={saving || !visit.visitedOn} onClick={createVisit} className="min-h-12 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">현장 방문 기록 저장</button>
          {(data?.visits ?? []).map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 p-3 text-sm sm:col-span-2"><span className="font-black">{item.visited_on}</span> · {item.actual_visit ? "실제 방문 확인" : "방문 미확인"} · {item.checked_fields?.length ?? 0}개 항목</div>)}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-2">{stageFields.map((field) => { const row = rows.get(field); return <button key={field} type="button" onClick={() => editField(field)} className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-3 text-left text-sm ring-1 ${selectedField === field ? "bg-white font-black text-slate-950 ring-teal-400" : "bg-white/70 font-semibold text-slate-700 ring-slate-200"}`}><span>{placeFieldLabels[field]}{row?.effective_status === "needs_recheck" && row.verification_status !== "needs_recheck" ? <small className="ml-1 text-amber-700">재확인</small> : null}</span><span className={`size-2.5 rounded-full ${row?.has_conflict ? "bg-rose-500" : row?.effective_status === "needs_recheck" ? "bg-amber-500" : row?.approval_status === "approved" ? "bg-teal-500" : row ? "bg-amber-400" : "bg-slate-300"}`} /></button>; })}</div>
        <div className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
          <div className="sm:col-span-2"><div className="flex items-center gap-2"><BadgeCheck size={18} className="text-teal-700" /><h4 className="font-black text-slate-950">{placeFieldLabels[selectedField]}</h4></div></div>
          {rows.get(selectedField)?.has_conflict ? <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-200 sm:col-span-2"><p className="font-black">출처 간 값 충돌 · 관리자 검토 필요</p><p className="mt-2 break-words">새 제안값: {stringifyValue(rows.get(selectedField)?.conflicting_value)}</p></div> : null}
          <Field label="현재 값"><textarea value={draft.currentValue} onChange={(event) => setDraft({ ...draft, currentValue: event.target.value })} className={textareaClass} /></Field>
          <Field label="출처 유형"><select value={draft.sourceType} onChange={(event) => setDraft({ ...draft, sourceType: event.target.value as PlaceFieldSourceType })} className={inputClass}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <Field label="검증 상태"><select value={draft.verificationStatus} onChange={(event) => setDraft({ ...draft, verificationStatus: event.target.value as PlaceFieldVerificationStatus })} className={inputClass}>{placeVerificationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="승인 상태"><select value={draft.approvalStatus} onChange={(event) => setDraft({ ...draft, approvalStatus: event.target.value as PlaceVerificationApproval, isPublic: event.target.value === "approved" ? draft.isPublic : false })} className={inputClass}><option value="pending">검토 대기</option><option value="approved">승인</option><option value="rejected">반려</option></select></Field>
          <Field label="출처 URL"><input type="url" value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} className={inputClass} /></Field>
          <Field label="확인 날짜"><input type="date" value={draft.verifiedAt} onChange={(event) => setDraft({ ...draft, verifiedAt: event.target.value })} className={inputClass} /></Field>
          {draft.verificationStatus === "field_verified" ? <Field label="실제 방문 기록"><select value={draft.visitId} onChange={(event) => setDraft({ ...draft, visitId: event.target.value, sourceType: "field_visit" })} className={inputClass}><option value="">방문 기록 선택</option>{(data?.visits ?? []).filter((item) => item.actual_visit).map((item) => <option key={item.id} value={item.id}>{item.visited_on} · {item.checked_fields.length}개 확인</option>)}</select></Field> : null}
          <Field label="비공개 관리자 메모"><textarea value={draft.privateNotes} onChange={(event) => setDraft({ ...draft, privateNotes: event.target.value })} className={textareaClass} /></Field>
          <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-teal-50 px-4 text-sm font-black text-teal-900"><input type="checkbox" disabled={draft.approvalStatus !== "approved"} checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} />사용자 화면에 검증 근거 표시</label>
          <button type="button" disabled={saving} onClick={saveField} className="min-h-12 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">정보별 검증 상태 저장</button>
        </div>
      </div>
      <details className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-black text-slate-900">정보별 재확인 주기 설정</summary>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.rules ?? []).map((rule) => <form key={rule.field_name} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() => request({ action: "update_rule", fieldName: rule.field_name, staleAfterDays: Number(values.get("days")), enabled: true }), `${placeFieldLabels[rule.field_name as ManagedPlaceField] ?? rule.field_name} 재확인 주기를 저장했습니다.`); }}><span className="min-w-0 flex-1 truncate text-xs font-black text-slate-700">{placeFieldLabels[rule.field_name as ManagedPlaceField] ?? rule.field_name}</span><input name="days" type="number" min="1" max="3650" defaultValue={rule.stale_after_days} aria-label={`${rule.field_name} 재확인 일수`} className="h-10 w-20 rounded-xl bg-white px-2 text-sm ring-1 ring-slate-200" /><button type="submit" className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white">저장</button></form>)}
        </div>
      </details>
    </section>
  );
}

function emptyDraft(): FieldDraft { return { currentValue: "", sourceType: "manual", sourceUrl: "", verificationStatus: "unverified", approvalStatus: "pending", verifiedAt: "", visitId: "", privateNotes: "", isPublic: false }; }
function stringifyValue(value: unknown) { if (value === undefined || value === null) return ""; return typeof value === "string" ? value : JSON.stringify(value, null, 2); }
function parseValue(value: string) { const text = value.trim(); if (!text) return null; if (text.startsWith("[") || text.startsWith("{")) { try { return JSON.parse(text) as unknown; } catch { return text; } } return text; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">{label}</span>{children}</label>; }
const inputClass = "h-12 w-full rounded-2xl bg-white px-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500";
const textareaClass = "min-h-24 w-full rounded-2xl bg-white px-3 py-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-500";
