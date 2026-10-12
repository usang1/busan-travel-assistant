"use client";

import { useEffect, useState } from "react";
import type { PlaceWithRelations } from "@/types/database";

type Application = {
  id: string; store_name: string; address: string; category: string; contact_name: string;
  contact_email: string | null; contact_phone: string | null; applicant_relationship: string;
  request_notes: string; status: string; admin_notes: string | null; linked_place_id: string | null;
  created_at: string; notification_status: string | null;
};

export function AdminBusinessApplications({ accessToken, places }: { accessToken: string; places: PlaceWithRelations[] }) {
  const [items, setItems] = useState<Application[]>([]);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");

  async function load() {
    const response = await fetch("/api/admin/business-applications", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setMessage(body.message ?? "입점 신청을 불러오지 못했습니다.");
    setItems(body.applications);
  }

  useEffect(() => { void load(); }, [accessToken]);

  async function save(item: Application) {
    setSavingId(item.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/business-applications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: item.status, admin_notes: item.admin_notes, linked_place_id: item.linked_place_id }),
      });
      const body = await response.json();
      setMessage(body.message ?? (response.ok ? "입점 신청을 처리했습니다." : "저장하지 못했습니다."));
      if (response.ok) await load();
    } finally {
      setSavingId("");
    }
  }

  function update(index: number, patch: Partial<Application>) {
    setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  return (
    <section id="business-applications" className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-2xl font-black">사장님 입점 신청</h2>
      <p className="mt-2 text-sm text-slate-600">승인하면 신청 상태, 사업자 역할, 기존 업체 소유권 연결이 한 트랜잭션으로 처리됩니다. 장소 UUID가 비어 있으면 사업자가 새 장소 정보를 작성해 검수를 요청할 수 있습니다.</p>
      {message ? <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm font-bold text-teal-800">{message}</p> : null}
      <div className="mt-4 space-y-4">
        {items.map((item, index) => (
          <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-black">{item.store_name}</h3><p className="text-sm text-slate-600">{item.address} · {item.category}</p></div><span className="text-xs font-bold">Telegram: {item.notification_status ?? "미기록"}</span></div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-black">담당자</dt><dd>{item.contact_name} · {item.applicant_relationship}</dd></div><div><dt className="font-black">연락처</dt><dd>{item.contact_email || item.contact_phone}</dd></div></dl>
            <p className="mt-3 whitespace-pre-wrap text-sm">{item.request_notes}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select disabled={item.status === "approved"} value={item.status} onChange={(event) => update(index, { status: event.target.value })} className={inputClass}><option value="pending">접수</option><option value="reviewing">검토 중</option><option value="more_info_requested">추가 정보 요청</option><option value="approved">승인</option><option value="rejected">반려</option></select>
              <input list="business-application-place-options" disabled={item.status === "approved"} value={item.linked_place_id ?? ""} onChange={(event) => update(index, { linked_place_id: event.target.value })} placeholder="기존 장소 UUID (선택)" className={inputClass} />
              <input value={item.admin_notes ?? ""} onChange={(event) => update(index, { admin_notes: event.target.value })} placeholder={item.status === "rejected" ? "반려 사유 (필수 권장)" : "처리 메모"} className={inputClass} />
            </div>
            <button disabled={savingId === item.id} type="button" onClick={() => void save(item)} className="mt-3 min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50">{savingId === item.id ? "처리 중" : item.status === "approved" ? "연결 상태 재확인" : "처리 저장"}</button>
          </article>
        ))}
      </div>
      <datalist id="business-application-place-options">{places.map((place) => <option key={place.id} value={place.id}>{place.name_ko || place.name_zh} · {place.address_ko}</option>)}</datalist>
    </section>
  );
}

const inputClass = "min-h-11 rounded-lg bg-white px-3 text-sm ring-1 ring-slate-200 outline-none disabled:bg-slate-100";
