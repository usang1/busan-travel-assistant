"use client";

import { useCallback, useEffect, useState } from "react";
import type { BusinessPlaceChangeRecord, BusinessPlaceChangeStatus } from "@/types/database";

type ReviewAction = "approve" | "changes_requested" | "reject";
const statusOptions: Array<{ value: "all" | BusinessPlaceChangeStatus; label: string }> = [
  { value: "pending_review", label: "검수 대기" },
  { value: "changes_requested", label: "보완 요청" },
  { value: "draft", label: "작성 중" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
  { value: "all", label: "전체" },
];

export function AdminBusinessPlaceChanges({ accessToken, onApproved }: { accessToken: string; onApproved: () => Promise<void> }) {
  const [changes, setChanges] = useState<BusinessPlaceChangeRecord[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"all" | BusinessPlaceChangeStatus>("pending_review");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (search.trim()) params.set("q", search.trim());
    const response = await fetch(`/api/admin/business-place-changes?${params}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "사업자 변경 요청을 불러오지 못했습니다.");
    setChanges(body.changes ?? []);
  }, [accessToken, search, status]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(timer); }, [load]);

  async function review(change: BusinessPlaceChangeRecord, action: ReviewAction) {
    if (action !== "approve" && !reasons[change.id]?.trim()) {
      setMessage(action === "reject" ? "반려 사유를 입력해 주세요." : "보완 요청 내용을 입력해 주세요.");
      return;
    }
    setBusy(change.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/business-place-changes/${change.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action, reason: reasons[change.id], targetPlaceId: targets[change.id] || null }),
      });
      const body = await response.json();
      setMessage(body.message ?? (response.ok ? "처리했습니다." : "처리하지 못했습니다."));
      if (response.ok) { await load(); if (action === "approve") await onApproved(); }
    } finally { setBusy(""); }
  }

  return (
    <section id="business-place-changes" className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-2xl font-black">사업자 장소 정보 검수</h2>
      <p className="mt-2 text-sm text-slate-600">입점 승인은 작성 권한만 부여합니다. 이 화면에서 승인해야 장소·메뉴·사진·다국어·여행자 정보가 한 트랜잭션으로 공개됩니다.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <select aria-label="검수 상태" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={inputClass}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="업체명 또는 제출 장소명 검색" className={inputClass} />
      </div>
      {message ? <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{message}</p> : null}
      <div className="mt-4 space-y-4">
        {changes.length ? changes.map((change) => {
          const payload = change.payload;
          const name = String(payload.name_ko ?? payload.name_zh ?? "이름 미입력");
          const canReview = change.status === "pending_review";
          return <article key={change.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="font-black">{change.application?.store_name ?? name}</h3><p className="mt-1 text-xs text-slate-500">제출자 {change.application?.contact_name ?? change.user_id} · 제출명 {name} · 입점 {change.application?.status ?? "확인 불가"} · {new Date(change.updated_at).toLocaleString("ko-KR")} · 메뉴 {payload.menu_items?.length ?? 0}개</p></div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">{statusLabel(change.status)}</span>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <Snapshot title="현재 공개 정보" value={change.existing_place ?? { 안내: "신규 장소로 현재 공개 정보가 없습니다." }} />
              <Snapshot title="사업자 제출 정보" value={payload} />
            </div>
            {change.audit?.length ? <details className="mt-3 rounded-xl bg-white p-3 text-xs ring-1 ring-slate-200"><summary className="cursor-pointer font-black">검수 이력 {change.audit.length}건</summary><ul className="mt-2 space-y-1">{change.audit.map((event) => <li key={event.id}>{new Date(event.created_at).toLocaleString("ko-KR")} · {event.previous_status ?? "-"} → {event.next_status}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ul></details> : null}
            {canReview && !change.place_id ? <input value={targets[change.id] ?? ""} onChange={(event) => setTargets((current) => ({ ...current, [change.id]: event.target.value }))} placeholder="기존 장소와 연결할 UUID (중복 업체일 때만 입력)" className={inputClass} /> : null}
            {canReview ? <>
              <textarea value={reasons[change.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [change.id]: event.target.value }))} placeholder="보완 요청 또는 반려 사유 (필수)" className={`${inputClass} min-h-20 py-3`} />
              <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy === change.id} onClick={() => void review(change, "approve")} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-50">최종 승인 및 공개</button><button disabled={busy === change.id} onClick={() => void review(change, "changes_requested")} className="min-h-11 rounded-xl bg-amber-100 px-4 text-sm font-black text-amber-950 disabled:opacity-50">보완 요청</button><button disabled={busy === change.id} onClick={() => void review(change, "reject")} className="min-h-11 rounded-xl bg-white px-4 text-sm font-black text-rose-700 ring-1 ring-rose-200 disabled:opacity-50">반려</button></div>
            </> : change.rejection_reason ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">처리 사유: {change.rejection_reason}</p> : null}
          </article>;
        }) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">조건에 맞는 장소 정보 제출 건이 없습니다.</p>}
      </div>
    </section>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return <details open className="rounded-xl bg-white p-3 text-xs ring-1 ring-slate-200"><summary className="cursor-pointer font-black">{title}</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre></details>;
}

function statusLabel(status: BusinessPlaceChangeStatus) {
  return { draft: "작성 중", pending_review: "검수 대기", changes_requested: "보완 요청", approved: "승인", rejected: "반려" }[status];
}

const inputClass = "min-h-11 w-full rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-slate-200";
