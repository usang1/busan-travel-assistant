"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type QueueRow = { placeId: string; name: string; score: number; reasons: string[]; views: number; directions: number; missing: string[]; stale: number; conflicts: number; stayRecommended: boolean };

export function AdminVerificationQueue({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; fetch("/api/admin/place-verification-priorities", { headers: { Authorization: `Bearer ${accessToken}` } }).then(async (response) => { const body = await response.json() as { queue?: QueueRow[]; message?: string }; if (!response.ok) throw new Error(body.message ?? "우선순위를 불러오지 못했습니다."); if (active) setRows(body.queue ?? []); }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "우선순위를 불러오지 못했습니다."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [accessToken]);
  return <section id="verification-priority" className="scroll-mt-24 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6"><div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-amber-100 text-amber-800"><AlertTriangle size={21} /></div><div><h2 className="text-xl font-black text-slate-950">장소 검증 우선순위</h2><p className="mt-1 text-sm leading-6 text-slate-600">숙소 추천, 실제 조회·길찾기, 누락·재확인·충돌 데이터를 기준으로 정렬합니다. 데이터가 없는 지표는 0으로 유지합니다.</p></div></div>{loading ? <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600"><RefreshCw size={16} className="animate-spin" />계산 중</p> : null}{message ? <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{message}</p> : null}{rows.length ? <div className="mt-5 grid gap-2">{rows.slice(0, 25).map((row, index) => <a key={row.placeId} href="#place-manager" className="grid gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center"><span className="text-center text-lg font-black text-slate-400">{index + 1}</span><div><p className="font-black text-slate-950">{row.name}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{row.reasons.join(" · ") || "우선 검수 사유 없음"}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">우선도 {row.score}</span></a>)}</div> : null}</section>;
}
