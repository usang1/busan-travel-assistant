"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { categoryLabels, type PlaceCorrectionRecord, type PlaceCorrectionStatus } from "@/types/database";

type AdminCorrectionWorkflowProps = {
  accessToken: string;
};

const statuses: PlaceCorrectionStatus[] = ["pending", "accepted", "rejected"];
const statusLabels: Record<PlaceCorrectionStatus, string> = {
  pending: "대기",
  accepted: "처리 완료",
  rejected: "거절",
};

const fieldLabels: Record<string, string> = {
  opening_hours: "영업시간",
  price: "가격",
  address: "주소",
  menu: "메뉴",
  closed: "폐업",
  other: "기타",
};

export function AdminCorrectionWorkflow({ accessToken }: AdminCorrectionWorkflowProps) {
  const [corrections, setCorrections] = useState<PlaceCorrectionRecord[]>([]);
  const [activeStatus, setActiveStatus] = useState<PlaceCorrectionStatus>("pending");
  const [status, setStatus] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const visibleCorrections = useMemo(
    () => corrections.filter((correction) => correction.status === activeStatus),
    [activeStatus, corrections],
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

  async function loadCorrections() {
    const response = await adminFetch("/api/admin/corrections");

    if (!response.ok) {
      const body = (await response.json()) as { message?: string };
      throw new Error(body.message ?? "수정 요청을 불러오지 못했습니다.");
    }

    const body = (await response.json()) as { corrections: PlaceCorrectionRecord[] };
    setCorrections(body.corrections);
  }

  async function updateCorrectionStatus(id: string, nextStatus: PlaceCorrectionStatus) {
    setSavingId(id);
    setStatus("");

    try {
      const response = await adminFetch(`/api/admin/corrections/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "수정 요청 처리에 실패했습니다.");
      }

      const body = (await response.json()) as { correction: PlaceCorrectionRecord };
      setCorrections((current) => current.map((correction) => (correction.id === id ? body.correction : correction)));
      setStatus(`${statusLabels[nextStatus]} 상태로 변경했습니다. 장소 수정은 아래 장소 관리에서 반영하세요.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "수정 요청 처리 중 오류가 발생했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  useEffect(() => {
    void loadCorrections().catch((error) => setStatus(error instanceof Error ? error.message : "수정 요청 목록 오류"));
    // accessToken changes only when the admin session changes.
  }, [accessToken]);

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950">정보 수정 요청</h2>
          <p className="mt-1 text-sm text-slate-500">요청 확인 후 장소 관리에서 수정하고 처리 완료 상태로 변경합니다.</p>
        </div>
        <button type="button" onClick={() => void loadCorrections()} className="grid size-10 place-items-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200">
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {statuses.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setActiveStatus(item)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ring-1 ${
              activeStatus === item ? "bg-slate-950 text-white ring-slate-950" : "bg-white text-slate-700 ring-slate-200"
            }`}
          >
            {statusLabels[item]} {corrections.filter((correction) => correction.status === item).length}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {visibleCorrections.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">해당 상태의 수정 요청이 없습니다.</div>
        ) : (
          visibleCorrections.map((correction) => {
            const place = correction.places;

            return (
              <article key={correction.id} className="rounded-[22px] bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {place ? `${place.name_ko} / ${place.name_zh}` : correction.place_id}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {fieldLabels[correction.field_name] ?? correction.field_name} · {correction.locale} · {new Date(correction.created_at).toLocaleString("ko-KR")}
                      {place ? ` · ${categoryLabels[place.category].ko}` : ""}
                    </p>
                  </div>
                  {place ? (
                    <Link href={`/places/${place.slug}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-black text-teal-700 ring-1 ring-teal-100">
                      장소 확인
                      <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>

                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {correction.current_value ? (
                    <div>
                      <dt className="text-xs font-black text-slate-500">현재 값</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-slate-700">{correction.current_value}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-black text-slate-500">제안 내용</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-800">{correction.suggested_value}</dd>
                  </div>
                  {correction.notes ? (
                    <div>
                      <dt className="text-xs font-black text-slate-500">메모</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-slate-700">{correction.notes}</dd>
                    </div>
                  ) : null}
                  {correction.source_url ? (
                    <div>
                      <dt className="text-xs font-black text-slate-500">출처</dt>
                      <dd className="mt-1">
                        <a href={correction.source_url} target="_blank" rel="noreferrer" className="break-all font-bold text-teal-700">
                          {correction.source_url}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingId === correction.id}
                    onClick={() => void updateCorrectionStatus(correction.id, "accepted")}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-black text-white disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    처리 완료
                  </button>
                  <button
                    type="button"
                    disabled={savingId === correction.id}
                    onClick={() => void updateCorrectionStatus(correction.id, "rejected")}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
                  >
                    <XCircle size={16} aria-hidden="true" />
                    거절
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {status ? <p className="mt-4 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{status}</p> : null}
    </section>
  );
}
