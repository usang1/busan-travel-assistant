"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Flag, MapPinCheck, RefreshCw, ShieldQuestion, XCircle } from "lucide-react";

type ModerationStatus = "pending" | "approved" | "rejected" | "needs_review";
type QueueFilter = "all" | "conflicting" | "flagged";

type TravelerReport = {
  id: string;
  checkin_id: string | null;
  place_id: string;
  fact_type: string;
  fact_value: unknown;
  observed_at: string;
  created_at: string;
  locale: string;
  verification_method: string;
  moderation_status: ModerationStatus;
  trust_weight: number | null;
  flagged_at: string | null;
  flag_reason: string | null;
  review_notes: string | null;
  actor_type: "authenticated" | "anonymous";
  has_conflict: boolean;
  evidence_count: number;
  privacy_reported: boolean;
  places: { id: string; slug: string; name_ko: string; name_zh: string } | null;
  place_checkins: { risk_flags: string[] } | null;
};

const statusFilters: Array<{ value: ModerationStatus; label: string }> = [
  { value: "pending", label: "신규" },
  { value: "needs_review", label: "재검토" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "거절" },
];

export function AdminTravelerReportWorkflow({ accessToken }: { accessToken: string }) {
  const [reports, setReports] = useState<TravelerReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<ModerationStatus>("pending");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/traveler-reports?status=${statusFilter}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json() as { reports?: TravelerReport[]; message?: string };
      if (!response.ok) throw new Error(body.message ?? "여행자 확인 제보를 불러오지 못했습니다.");
      setReports(body.reports ?? []);
    } catch (error) {
      setReports([]);
      setMessage(error instanceof Error ? error.message : "여행자 확인 제보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const visibleReports = useMemo(() => reports.filter((report) => queueFilter === "all" || (queueFilter === "conflicting" ? report.has_conflict : report.privacy_reported)), [queueFilter, reports]);

  async function moderate(id: string, status: Exclude<ModerationStatus, "pending">) {
    setSavingId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/traveler-reports/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "검수 상태를 변경하지 못했습니다.");
      setReports((current) => current.filter((report) => report.id !== id));
      setMessage("검수 상태를 변경했습니다. 정식 장소 정보는 별도 편집 후 반영하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "검수 상태를 변경하지 못했습니다.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section id="traveler-reports" className="scroll-mt-24 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-teal-700">현장 확인 검수</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">여행자 제보 큐</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">원본 제보는 비공개입니다. 승인해도 정식 장소 필드를 자동으로 덮어쓰지 않으며, 상충 항목은 재검토 상태로 유지할 수 있습니다.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="grid size-11 place-items-center rounded-lg bg-slate-100 text-slate-700" aria-label="제보 새로고침"><RefreshCw size={18} aria-hidden="true" /></button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="검수 상태">
        {statusFilters.map((filter) => <button key={filter.value} type="button" role="tab" aria-selected={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-black ${statusFilter === filter.value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>{filter.label}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {([['all', '전체'], ['conflicting', '상충 우선'], ['flagged', '신고·개인정보 우선']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={queueFilter === value} onClick={() => setQueueFilter(value)} className={`min-h-10 rounded-full px-3 text-xs font-black ring-1 ${queueFilter === value ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-slate-200"}`}>{label}</button>)}
      </div>

      <div className="mt-5 space-y-3">
        {loading ? <p className="text-sm font-bold text-slate-500">불러오는 중입니다.</p> : visibleReports.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">이 조건의 제보가 없습니다.</p> : visibleReports.map((report) => (
          <article key={report.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-slate-950">{report.places?.name_ko ?? report.place_id}</p>
                {report.places?.name_zh ? <p className="mt-0.5 text-sm text-slate-500">{report.places.name_zh}</p> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.has_conflict ? <QueueBadge icon={AlertTriangle} label="상충" tone="warning" /> : null}
                {report.privacy_reported ? <QueueBadge icon={Flag} label="신고" tone="danger" /> : null}
                {report.place_checkins?.risk_flags.length ? <QueueBadge icon={AlertTriangle} label="비정상 패턴" tone="warning" /> : null}
                <QueueBadge icon={report.verification_method === "location" ? MapPinCheck : ShieldQuestion} label={methodLabel(report)} />
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs font-black text-slate-500">확인 항목</dt><dd className="mt-1 break-words font-bold text-slate-900">{factLabels[report.fact_type] ?? report.fact_type}</dd></div>
              <div><dt className="text-xs font-black text-slate-500">제보 값</dt><dd className="mt-1 break-words font-bold text-slate-900">{displayValue(report)}</dd></div>
              <div><dt className="text-xs font-black text-slate-500">관찰 시각</dt><dd className="mt-1 font-bold text-slate-900">{new Date(report.observed_at).toLocaleString("ko-KR")}</dd></div>
            </dl>
            {report.flag_reason ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-900">신고 사유: {report.flag_reason}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {report.places ? <a href={`/ko/admin?place=${encodeURIComponent(report.place_id)}#traveler-decision`} className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-sm font-black text-white">장소 데이터 확인</a> : null}
              {statusFilter !== "approved" ? <button type="button" disabled={savingId === report.id} onClick={() => void moderate(report.id, "approved")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-sm font-black text-white disabled:opacity-50"><BadgeCheck size={16} aria-hidden="true" />승인</button> : null}
              {statusFilter !== "needs_review" ? <button type="button" disabled={savingId === report.id} onClick={() => void moderate(report.id, "needs_review")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-sm font-black text-amber-900 ring-1 ring-amber-200 disabled:opacity-50"><ShieldQuestion size={16} aria-hidden="true" />재검토</button> : null}
              {statusFilter !== "rejected" ? <button type="button" disabled={savingId === report.id} onClick={() => void moderate(report.id, "rejected")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-black text-rose-700 ring-1 ring-rose-200 disabled:opacity-50"><XCircle size={16} aria-hidden="true" />거절</button> : null}
            </div>
          </article>
        ))}
      </div>
      {message ? <p aria-live="polite" className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </section>
  );
}

function QueueBadge({ icon: Icon, label, tone = "default" }: { icon: typeof AlertTriangle; label: string; tone?: "default" | "warning" | "danger" }) {
  const classes = tone === "danger" ? "bg-rose-50 text-rose-800" : tone === "warning" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${classes}`}><Icon size={13} aria-hidden="true" />{label}</span>;
}

function methodLabel(report: TravelerReport) {
  if (report.verification_method === "location") return "장소 근처 확인";
  return report.actor_type === "authenticated" ? "로그인 제보" : "익명 제보";
}

function displayValue(report: TravelerReport) {
  if (report.fact_type === "waiting_minutes") return `${String(report.fact_value)}분`;
  if (typeof report.fact_value === "boolean") return report.fact_value ? "해당함" : "해당하지 않음";
  return JSON.stringify(report.fact_value);
}

const factLabels: Record<string, string> = {
  waiting_minutes: "웨이팅", foreign_card: "해외카드", alipay: "알리페이", wechat_pay: "위챗페이", chinese_menu: "중국어 메뉴",
  solo_friendly: "혼자 방문", luggage_friendly: "캐리어", restroom: "매장 화장실", sold_out: "재료 소진", early_closed: "조기 마감",
  photo_matches: "사진과 실제", not_recommended_now: "현재 시간 비추천", information_changed: "정보 변경", closed: "휴무·폐점",
  ordering_failed: "메뉴 주문 실패", minimum_order: "최소 주문", cash_only: "현금만 가능", no_foreign_menu: "외국어 메뉴 없음",
  restroom_problem: "화장실 문제", transport_difficult: "교통 불편", too_spicy: "너무 매움", too_oily: "너무 느끼함", portion_mismatch: "양 불일치",
};
