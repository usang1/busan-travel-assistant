import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";

const statuses = ["pending", "approved", "rejected", "needs_review"] as const;
type Status = (typeof statuses)[number];

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const requestedStatus = new URL(request.url).searchParams.get("status") ?? "pending";
    if (!statuses.includes(requestedStatus as Status)) return NextResponse.json({ message: "지원하지 않는 상태입니다." }, { status: 400 });

    const { data, error } = await client
      .from("place_fact_reports")
      .select("id, checkin_id, place_id, fact_type, fact_value, observed_at, created_at, locale, user_id, verification_method, moderation_status, trust_weight, flagged_at, flag_reason, review_notes, places(id, slug, name_ko, name_zh), place_checkins(risk_flags)")
      .eq("moderation_status", requestedStatus)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw migrationError(error);

    const rows = (data ?? []) as unknown as RawReport[];
    const reportIds = rows.map((row) => row.id);
    const placeIds = [...new Set(rows.map((row) => row.place_id))];
    const [{ data: evidence, error: evidenceError }, { data: comparisons, error: comparisonError }] = await Promise.all([
      reportIds.length
        ? client.from("place_report_evidence").select("report_id, privacy_status").in("report_id", reportIds)
        : Promise.resolve({ data: [], error: null }),
      placeIds.length
        ? client.from("place_fact_reports").select("place_id, fact_type, fact_value").in("place_id", placeIds).in("moderation_status", ["approved", "pending", "needs_review"]).limit(1000)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (evidenceError) throw migrationError(evidenceError);
    if (comparisonError) throw migrationError(comparisonError);

    const evidenceRows = (evidence ?? []) as Array<{ report_id: string; privacy_status: string }>;
    const comparisonRows = (comparisons ?? []) as Array<{ place_id: string; fact_type: string; fact_value: unknown }>;
    const reports = rows.map((row) => {
      const reportEvidence = evidenceRows.filter((item) => item.report_id === row.id);
      const hasConflict = comparisonRows.some((item) => item.place_id === row.place_id && item.fact_type === row.fact_type && JSON.stringify(item.fact_value) !== JSON.stringify(row.fact_value));
      const { user_id: userId, ...publicRow } = row;
      return {
        ...publicRow,
        actor_type: userId ? "authenticated" : "anonymous",
        has_conflict: hasConflict,
        evidence_count: reportEvidence.length,
        privacy_reported: reportEvidence.some((item) => item.privacy_status === "reported") || Boolean(row.flagged_at),
      };
    });

    return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

type RawReport = {
  id: string;
  checkin_id: string | null;
  place_id: string;
  fact_type: string;
  fact_value: unknown;
  observed_at: string;
  created_at: string;
  locale: string;
  user_id: string | null;
  verification_method: string;
  moderation_status: Status;
  trust_weight: number | null;
  flagged_at: string | null;
  flag_reason: string | null;
  review_notes: string | null;
  places: { id: string; slug: string; name_ko: string; name_zh: string } | null;
  place_checkins: { risk_flags: string[] } | null;
};

function migrationError(error: { code?: string; message?: string }) {
  if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "")) {
    return Object.assign(new Error("여행자 확인 DB migration(030, 033)을 먼저 적용해주세요."), { status: 503, expose: true });
  }
  return error;
}
