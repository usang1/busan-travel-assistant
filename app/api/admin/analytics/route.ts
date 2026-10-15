import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { aggregateGrowthEvents, type AnalyticsEventRow } from "@/lib/analytics-aggregation";

export const dynamic = "force-dynamic";
const maxRows = 20_000;

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const url = new URL(request.url);
    const to = parseDate(url.searchParams.get("to"), seoulMidnight(new Date()));
    const defaultFrom = new Date(to.getTime() - 29 * 86_400_000);
    const from = parseDate(url.searchParams.get("from"), defaultFrom);
    if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000) {
      return NextResponse.json({ message: "조회 기간은 최대 366일이며 시작일이 종료일보다 빨라야 합니다." }, { status: 400 });
    }

    const placeId = validUuid(url.searchParams.get("placeId"));
    const provider = safeDimension(url.searchParams.get("provider"));
    const channel = safeDimension(url.searchParams.get("channel"));
    const campaignId = safeDimension(url.searchParams.get("campaignId"));
    const stayId = safeDimension(url.searchParams.get("stayId"));
    let rows: AnalyticsEventRow[] = [];
    let reachedLimit = false;

    for (let offset = 0; offset < maxRows; offset += 1000) {
      let query = client
        .from("place_action_events")
        .select("id,user_id,place_id,locale,event_type,metadata,created_at")
        .gte("created_at", from.toISOString())
        .lt("created_at", endExclusive(to).toISOString())
        .order("created_at", { ascending: true })
        .range(offset, offset + 999);
      if (placeId) query = query.eq("place_id", placeId);
      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as AnalyticsEventRow[];
      rows.push(...page);
      if (page.length < 1000) break;
      if (offset + page.length >= maxRows) reachedLimit = true;
    }

    rows = rows.filter((row) => (
      (!provider || row.metadata?.provider === provider)
      && (!channel || row.metadata?.channel === channel)
      && (!campaignId || row.metadata?.campaign_id === campaignId)
      && (!stayId || row.metadata?.stay_id === stayId)
    ));

    return NextResponse.json({
      from: from.toISOString(),
      to: endExclusive(to).toISOString(),
      truncated: reachedLimit,
      ...aggregateGrowthEvents(rows),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function parseDate(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return fallback;
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function endExclusive(date: Date) {
  return new Date(date.getTime() + 86_400_000);
}

function seoulMidnight(date: Date) {
  const value = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return new Date(`${value}T00:00:00+09:00`);
}

function validUuid(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value) ? value : "";
}

function safeDimension(value: string | null) {
  return value && /^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(value) ? value : "";
}
