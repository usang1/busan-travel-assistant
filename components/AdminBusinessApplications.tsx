"use client";

import { useEffect, useState } from "react";
import type { PlaceWithRelations } from "@/types/database";

type Application = {
  id: string; store_name: string; address: string; category: string; contact_name: string;
  contact_email: string | null; contact_phone: string | null; applicant_relationship: string;
  request_notes: string; status: string; admin_notes: string | null; linked_place_id: string | null;
  applicant_role: "owner" | "staff" | "agency" | null;
  map_url: string | null; map_provider: string; created_at: string; notification_status: string | null;
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
      <p className="mt-2 text-sm text-slate-600">승인하면 신청 상태, 사업자 역할, 기존 업체 소유권 연결이 한 트랜잭션으로 처리됩니다. 기존 장소는 목록에서 선택하거나 지도 링크·네이버 플레이스 번호로 찾을 수 있으며, 내부 UUID를 알 필요가 없습니다. 신규 업체는 입력칸을 비워 두세요.</p>
      {message ? <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm font-bold text-teal-800">{message}</p> : null}
      <div className="mt-4 space-y-4">
        {items.map((item, index) => (
          <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-black">{item.store_name || "네이버 플레이스 입점 신청"}</h3><p className="text-sm text-slate-600">{item.address} · {item.category}</p></div><div className="text-right text-xs font-bold text-slate-500"><p>{new Date(item.created_at).toLocaleString("ko-KR")}</p><p>Telegram: {item.notification_status ?? "미기록"}</p></div></div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="font-black">신청자</dt><dd>{item.contact_name}</dd></div><div><dt className="font-black">신청자 역할</dt><dd>{applicantRoleLabel(item.applicant_role, item.applicant_relationship)}</dd></div><div><dt className="font-black">연락처</dt><dd>{item.contact_phone || item.contact_email || "미입력"}</dd></div></dl>
            {item.map_url ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><a href={item.map_url} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">신청 지도 링크 열기</a>{item.status !== "approved" ? <button type="button" onClick={() => update(index, { linked_place_id: item.map_url })} className="min-h-9 rounded-lg bg-white px-3 text-xs font-black ring-1 ring-slate-200">이 링크로 기존 장소 찾기</button> : null}</div> : null}
            {displayRequestNotes(item.request_notes) ? <p className="mt-3 whitespace-pre-wrap text-sm">{displayRequestNotes(item.request_notes)}</p> : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <select disabled={item.status === "approved"} value={item.status} onChange={(event) => update(index, { status: event.target.value })} className={inputClass}><option value="pending">접수</option><option value="reviewing">검토 중</option><option value="more_info_requested">추가 정보 요청</option><option value="approved">승인</option><option value="rejected">반려</option></select>
              <input list="business-application-place-options" disabled={item.status === "approved"} value={item.linked_place_id ?? ""} onChange={(event) => update(index, { linked_place_id: event.target.value })} placeholder="기존 장소 선택 · 지도 링크/번호 (선택)" aria-label="연결할 기존 장소, 지도 링크 또는 네이버 플레이스 번호" className={inputClass} />
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
function applicantRoleLabel(role: Application["applicant_role"], legacy: string) {
  const normalizedRole = role ?? (legacy === "owner" || legacy === "staff" || legacy === "agency" ? legacy : null);
  return normalizedRole ? { owner: "대표자 / 사업주", staff: "직원 / 매니저", agency: "마케팅 대행사" }[normalizedRole] : legacy;
}
function displayRequestNotes(value: string) {
  const prefix = "__SPOTZARI_APPLICATION_META__:";
  if (!value.startsWith(prefix)) return value;
  try {
    const metadata = JSON.parse(value.slice(prefix.length)) as { consent_version?: string };
    return metadata.consent_version ? `개인정보 고지 버전: ${metadata.consent_version}` : "";
  } catch {
    return "";
  }
}
