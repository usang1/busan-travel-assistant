import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { createServerServiceClient } from "@/lib/server-supabase";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => null) as { from?: string; to?: string } | null;
    const to = validDate(body?.to) || seoulDate(new Date());
    const from = validDate(body?.from) || seoulDate(new Date(Date.now() - 2 * 86_400_000));
    if (from > to || daysBetween(from, to) > 31) return NextResponse.json({ message: "수동 집계 범위는 최대 31일입니다." }, { status: 400 });
    const client = createServerServiceClient();
    const { error } = await client.rpc("refresh_analytics_daily_stats", { period_start: from, period_end: to });
    if (error) {
      if (["42883", "PGRST202"].includes(error.code || "")) return NextResponse.json({ message: "분석 집계 마이그레이션 054를 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ ok: true, from, to, refreshedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : ""; }
function seoulDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }
