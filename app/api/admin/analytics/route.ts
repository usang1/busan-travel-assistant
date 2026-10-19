import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { aggregateDailyGrowthStats, aggregateDailyPlaceRankings, aggregateGrowthEvents, type AnalyticsEventRow, type DailyAnalyticsRow } from "@/lib/analytics-aggregation";
import { toCsv } from "@/lib/csv";

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
    const source = safeDimension(url.searchParams.get("source"));
    const device = safeDimension(url.searchParams.get("device"));
    const format = url.searchParams.get("format");

    if (!provider && !stayId) {
      const daily = await readDailyReport(client, { from, to, placeId, channel, campaignId, source, device });
      if (daily) {
        const payload = { from: from.toISOString(), to: endExclusive(to).toISOString(), truncated: false, aggregation: "daily", limitations: ["일별 고유 방문자 수는 날짜 간 단순 합산할 수 없어 기간 전체 고유 방문자는 표시하지 않습니다.", "광고 차단기와 네트워크 장애로 일부 이벤트가 누락될 수 있습니다."], ...daily };
        if (format === "csv") return csvResponse(payload);
        return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
      }
    }
    let rows: AnalyticsEventRow[] = [];
    let reachedLimit = false;

    for (let offset = 0; offset < maxRows; offset += 1000) {
      let query = client
        .from("place_action_events")
        .select("id,user_id,place_id,locale,event_type,metadata,created_at,occurred_at,anonymous_session_id,device_type,channel,source")
        .gte("created_at", from.toISOString())
        .lt("created_at", endExclusive(to).toISOString())
        .order("created_at", { ascending: true })
        .range(offset, offset + 999);
      if (placeId) query = query.eq("place_id", placeId);
      let { data, error } = await query;
      if (error && ["42703", "PGRST204", "PGRST205"].includes(error.code || "")) {
        let legacyQuery = client
          .from("place_action_events")
          .select("id,user_id,place_id,locale,event_type,metadata,created_at")
          .gte("created_at", from.toISOString())
          .lt("created_at", endExclusive(to).toISOString())
          .order("created_at", { ascending: true })
          .range(offset, offset + 999);
        if (placeId) legacyQuery = legacyQuery.eq("place_id", placeId);
        const legacy = await legacyQuery;
        data = legacy.data as typeof data;
        error = legacy.error;
      }
      if (error) throw error;
      const page = (data ?? []) as AnalyticsEventRow[];
      rows.push(...page);
      if (page.length < 1000) break;
      if (offset + page.length >= maxRows) reachedLimit = true;
    }

    rows = rows.filter((row) => (
      (!provider || row.metadata?.provider === provider)
      && (!channel || row.channel === channel || row.metadata?.channel === channel)
      && (!campaignId || row.metadata?.campaign_id === campaignId)
      && (!stayId || row.metadata?.stay_id === stayId)
      && (!source || row.source === source || row.metadata?.initial_source === source)
      && (!device || row.device_type === device)
    ));

    const payload = {
      from: from.toISOString(),
      to: endExclusive(to).toISOString(),
      truncated: reachedLimit,
      aggregation: "raw",
      limitations: ["광고 차단기와 네트워크 장애로 일부 이벤트가 누락될 수 있습니다.", "조회·길찾기는 실제 방문 또는 결제를 의미하지 않습니다."],
      ...aggregateGrowthEvents(rows),
    };
    if (format === "csv") return csvResponse(payload);
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

async function readDailyReport(client: Awaited<ReturnType<typeof requireAdmin>>["client"], filters: { from: Date; to: Date; placeId: string; channel: string; campaignId: string; source: string; device: string }) {
  const table = filters.placeId ? "analytics_daily_place_stats" : "analytics_daily_platform_stats";
  let query = client.from(table).select("stat_date,event_name,locale,device_type,channel,source,campaign_id,event_count,unique_visitors,updated_at" + (filters.placeId ? ",place_id" : "")).gte("stat_date", dateOnly(filters.from)).lte("stat_date", dateOnly(filters.to)).limit(50_000);
  if (filters.placeId) query = query.eq("place_id", filters.placeId);
  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.device) query = query.eq("device_type", filters.device);
  const { data, error } = await query;
  if (error || !data?.length) return null;
  const report = aggregateDailyGrowthStats(data as unknown as DailyAnalyticsRow[]);
  if (!filters.placeId) {
    let placesQuery = client.from("analytics_daily_place_stats").select("stat_date,place_id,event_name,locale,device_type,channel,source,campaign_id,event_count,unique_visitors,updated_at").gte("stat_date", dateOnly(filters.from)).lte("stat_date", dateOnly(filters.to)).in("event_name", ["place_view", "place_opened", "place_save", "place_saved", "directions_click", "map_opened", "coupon_redeem", "coupon_redeemed"]).limit(50_000);
    if (filters.channel) placesQuery = placesQuery.eq("channel", filters.channel);
    if (filters.campaignId) placesQuery = placesQuery.eq("campaign_id", filters.campaignId);
    if (filters.source) placesQuery = placesQuery.eq("source", filters.source);
    if (filters.device) placesQuery = placesQuery.eq("device_type", filters.device);
    const places = await placesQuery;
    if (!places.error) report.popularPlaces = aggregateDailyPlaceRankings((places.data ?? []) as unknown as DailyAnalyticsRow[]);
  }
  return report;
}

function csvResponse(payload: { from: string; to: string; daily: Array<{ date: string; events: number; visitors: number; placeViews: number; directions: number; couponRedemptions: number }> }) {
  const rows = payload.daily.map((item) => ({ date: item.date, total_events: item.events, unique_visitors: item.visitors, place_views: item.placeViews, directions_clicks: item.directions, coupon_redemptions: item.couponRedemptions }));
  return new NextResponse(toCsv(["date", "total_events", "unique_visitors", "place_views", "directions_clicks", "coupon_redemptions"], rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="spotzari-analytics-${payload.from.slice(0, 10)}-${payload.to.slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
}

function dateOnly(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }

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
