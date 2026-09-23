"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Link2Off, RefreshCw, SearchX, ShieldQuestion, XCircle } from "lucide-react";

type ModerationStatus = "pending" | "approved" | "rejected" | "needs_review" | "all";
type Candidate = {
  place_id: string;
  confidence: number | null;
  match_reasons: string[];
  match_source: string;
  confirmed_by_user: boolean;
  places: { id: string; slug: string; name_ko: string; name_zh: string; address_ko: string } | null;
};
type Mapping = {
  id: string;
  source_platform: string;
  input_kind: string;
  extracted_place_terms: string[];
  extracted_region_terms: string[];
  extracted_station_terms: string[];
  extracted_menu_terms: string[];
  extracted_landmark_terms: string[];
  extracted_hashtags: string[];
  place_alias: string;
  match_confidence: number | null;
  confirmed_place_id: string | null;
  confirmed_by_user_at: string | null;
  moderation_status: Exclude<ModerationStatus, "all">;
  processing_status: string;
  created_at: string;
  sns_place_candidates: Candidate[];
};
type RequestStat = { source_platform: string; result_status: string; input_kind: string; used_ocr: boolean; created_at: string };

export function AdminSocialDiscoveryManager({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<ModerationStatus>("pending");
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [requests, setRequests] = useState<RequestStat[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/social-discovery?status=${status}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json() as { mappings?: Mapping[]; requests?: RequestStat[]; message?: string };
      if (!response.ok) throw new Error(body.message ?? "SNS 매칭 큐를 불러오지 못했습니다.");
      setMappings(body.mappings ?? []);
      setRequests(body.requests ?? []);
      setAliases(Object.fromEntries((body.mappings ?? []).map((mapping) => [mapping.id, mapping.place_alias])));
    } catch (error) {
      setMappings([]);
      setRequests([]);
      setMessage(error instanceof Error ? error.message : "SNS 매칭 큐를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, status]);

  useEffect(() => { void load(); }, [load]);

  async function update(mapping: Mapping, action: "approve" | "reject" | "needs_review" | "unmap" | "alias", placeId?: string) {
    setSaving(`${mapping.id}:${action}:${placeId ?? ""}`);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/social-discovery/${mapping.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, placeId, alias: aliases[mapping.id] ?? "" }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "매핑 상태를 변경하지 못했습니다.");
      setMessage(action === "approve" ? "공개 장소 별칭 매핑을 승인했습니다." : "매핑 상태를 변경했습니다.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "매핑 상태를 변경하지 못했습니다.");
    } finally {
      setSaving("");
    }
  }

  const stats = useMemo(() => {
    const byPlatform = requests.reduce<Record<string, number>>((acc, request) => ({ ...acc, [request.source_platform]: (acc[request.source_platform] ?? 0) + 1 }), {});
    return {
      total: requests.length,
      matched: requests.filter((request) => request.result_status === "matched").length,
      failed: requests.filter((request) => ["failed", "ocr_failed", "ocr_unavailable"].includes(request.result_status)).length,
      byPlatform,
    };
  }, [requests]);

  return (
    <section id="social-discovery" className="scroll-mt-24 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-teal-700">SNS 장소 연결</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">별칭·후보 검수 큐</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">원문 URL, 게시물 본문, 캡처는 저장하지 않습니다. 사용자 확인은 검수 신호일 뿐이며 운영자 승인 전 공개 별칭으로 사용하지 않습니다.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-label="SNS 매칭 새로고침"><RefreshCw size={18} aria-hidden="true" /></button>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <Stat label="최근 30일 요청" value={stats.total} />
        <Stat label="후보 발견" value={stats.matched} />
        <Stat label="OCR·처리 실패" value={stats.failed} warning={stats.failed > 0} />
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
        {Object.entries(stats.byPlatform).map(([platform, count]) => <span key={platform} className="rounded-full bg-slate-100 px-2.5 py-1">{platform} {count}</span>)}
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="SNS 매핑 검수 상태">
        {statusFilters.map((filter) => <button key={filter.value} type="button" role="tab" aria-selected={status === filter.value} onClick={() => setStatus(filter.value)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-black ${status === filter.value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>{filter.label}</button>)}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? <p className="text-sm font-bold text-slate-500">불러오는 중입니다.</p> : mappings.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">이 조건의 SNS 매핑이 없습니다.</p> : mappings.map((mapping) => {
          const candidates = [...(mapping.sns_place_candidates ?? [])].sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0));
          const duplicateRisk = candidates.length > 1 && Number(candidates[0]?.confidence ?? 0) - Number(candidates[1]?.confidence ?? 0) <= 10;
          const clues = [...mapping.extracted_place_terms, ...mapping.extracted_region_terms, ...mapping.extracted_station_terms, ...mapping.extracted_menu_terms, ...mapping.extracted_landmark_terms, ...mapping.extracted_hashtags];
          return (
            <article key={mapping.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-black text-slate-950">{mapping.place_alias || mapping.extracted_place_terms[0] || "별칭 미확인"}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{mapping.source_platform} · {mapping.input_kind} · {new Date(mapping.created_at).toLocaleString("ko-KR")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {mapping.confirmed_by_user_at ? <Badge label="사용자 확인" tone="success" /> : null}
                  {duplicateRisk ? <Badge label="중복 후보" tone="warning" /> : null}
                  {mapping.processing_status === "no_match" ? <Badge label="후보 없음" tone="danger" /> : null}
                  {Number(mapping.match_confidence ?? 0) < 55 && candidates.length ? <Badge label="낮은 신뢰도" tone="warning" /> : null}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {clues.slice(0, 12).map((term, index) => <span key={`${term}:${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{term}</span>)}
              </div>

              <label className="mt-4 block max-w-xl">
                <span className="text-xs font-black text-slate-500">중국어·SNS 별칭</span>
                <span className="mt-1 flex gap-2">
                  <input value={aliases[mapping.id] ?? ""} onChange={(event) => setAliases((current) => ({ ...current, [mapping.id]: event.target.value.slice(0, 300) }))} className="h-11 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 text-sm font-bold outline-none ring-1 ring-slate-200" />
                  <button type="button" disabled={Boolean(saving)} onClick={() => void update(mapping, "alias")} className="min-h-11 rounded-lg bg-white px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200">별칭 저장</button>
                </span>
              </label>

              {candidates.length ? (
                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                  {candidates.map((candidate) => (
                    <div key={candidate.place_id} className={`rounded-lg p-3 ring-1 ${candidate.confirmed_by_user ? "bg-teal-50 ring-teal-200" : "bg-slate-50 ring-slate-200"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-slate-950">{candidate.places?.name_ko ?? candidate.place_id}</p>
                          {candidate.places?.name_zh ? <p className="mt-0.5 break-words text-xs font-bold text-slate-500">{candidate.places.name_zh}</p> : null}
                          {candidate.places?.address_ko ? <p className="mt-1 break-words text-xs leading-5 text-slate-500">{candidate.places.address_ko}</p> : null}
                        </div>
                        <span className="shrink-0 text-xs font-black text-teal-800">{candidate.confidence ?? 0}%</span>
                      </div>
                      <p className="mt-2 break-words text-xs font-bold text-slate-600">근거: {candidate.match_reasons.join(" · ") || "자동 규칙"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={Boolean(saving) || !candidate.places} onClick={() => void update(mapping, "approve", candidate.place_id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-xs font-black text-white disabled:opacity-50"><BadgeCheck size={15} aria-hidden="true" />이 장소 승인</button>
                        {candidate.places ? <a href={`/ko/places/${candidate.places.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-xs font-black text-slate-700 ring-1 ring-slate-200">상세 확인</a> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-950 ring-1 ring-amber-100">
                  <SearchX size={17} aria-hidden="true" />중복 후보를 먼저 검색한 뒤 신규 장소 제보 큐에서 검수하세요.
                  <a href="#place-submissions" className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-xs font-black ring-1 ring-amber-200">신규 장소 제보 보기</a>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {mapping.moderation_status !== "needs_review" ? <button type="button" disabled={Boolean(saving)} onClick={() => void update(mapping, "needs_review")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-sm font-black text-amber-900 ring-1 ring-amber-200"><ShieldQuestion size={16} aria-hidden="true" />재검토</button> : null}
                {mapping.confirmed_place_id ? <button type="button" disabled={Boolean(saving)} onClick={() => void update(mapping, "unmap")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-black text-slate-700 ring-1 ring-slate-200"><Link2Off size={16} aria-hidden="true" />매핑 해제</button> : null}
                {mapping.moderation_status !== "rejected" ? <button type="button" disabled={Boolean(saving)} onClick={() => void update(mapping, "reject")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-black text-rose-700 ring-1 ring-rose-200"><XCircle size={16} aria-hidden="true" />반려</button> : null}
              </div>
            </article>
          );
        })}
      </div>
      {message ? <p aria-live="polite" className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </section>
  );
}

function Stat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className={`rounded-lg px-3 py-3 ring-1 ${warning ? "bg-amber-50 ring-amber-100" : "bg-slate-50 ring-slate-200"}`}><dt className="text-xs font-black text-slate-500">{label}</dt><dd className="mt-1 text-xl font-black text-slate-950">{value}</dd></div>;
}

function Badge({ label, tone }: { label: string; tone: "success" | "warning" | "danger" }) {
  const Icon = tone === "danger" ? AlertTriangle : tone === "success" ? BadgeCheck : ShieldQuestion;
  const classes = tone === "danger" ? "bg-rose-50 text-rose-800" : tone === "success" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${classes}`}><Icon size={13} aria-hidden="true" />{label}</span>;
}

const statusFilters: Array<{ value: ModerationStatus; label: string }> = [
  { value: "pending", label: "신규" },
  { value: "needs_review", label: "사용자 확인·재검토" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
  { value: "all", label: "전체" },
];
