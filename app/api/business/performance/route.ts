import { NextResponse } from "next/server";
import { businessErrorResponse, isUuid, requireAuthenticatedUser } from "@/lib/business-auth";
import { resolveBusinessEntitlement } from "@/lib/business-entitlements";
import { aggregateBusinessPerformance, performanceChanges, type BusinessPerformanceRpcRow } from "@/lib/business-performance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { client, user } = await requireAuthenticatedUser(request);
    const params = new URL(request.url).searchParams;
    const placeId = params.get("placeId") || "";
    if (!isUuid(placeId)) return NextResponse.json({ message: "관리할 가게를 선택해 주세요." }, { status: 400 });
    const to = parseDate(params.get("to"), new Date());
    const from = parseDate(params.get("from"), new Date(to.getTime() - 29 * 86_400_000));
    const periodEnd = new Date(to.getTime() + 86_400_000);
    if (periodEnd <= from || periodEnd.getTime() - from.getTime() > 366 * 86_400_000) return NextResponse.json({ message: "조회 기간은 최대 366일까지 선택할 수 있습니다." }, { status: 400 });
    const membership = await client.from("business_place_memberships").select("place_id").eq("place_id", placeId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (membership.error || !membership.data) return NextResponse.json({ message: "본인 가게의 성과만 확인할 수 있습니다." }, { status: 403 });
    const duration = periodEnd.getTime() - from.getTime();
    const previousEnd = from;
    const previousStart = new Date(from.getTime() - duration);
    const [subscriptions, currentResult, previousResult, reports] = await Promise.all([
      client.from("business_subscriptions").select("status,starts_at,ends_at,place_id,subscription_plans(code,name,features)").eq("business_user_id", user.id).in("status", ["trial", "active"]).order("starts_at", { ascending: false }),
      client.rpc("get_business_place_performance", { target_place_id: placeId, period_start: from.toISOString(), period_end: periodEnd.toISOString() }),
      client.rpc("get_business_place_performance", { target_place_id: placeId, period_start: previousStart.toISOString(), period_end: previousEnd.toISOString() }),
      client.from("business_performance_reports").select("id,place_id,period_start,period_end,generated_at,data_version").eq("place_id", placeId).order("generated_at", { ascending: false }).limit(12),
    ]);
    if (currentResult.error) {
      if (currentResult.error.code === "42883" || currentResult.error.code === "PGRST202") return NextResponse.json({ message: "사업자 리포트 DB 마이그레이션(055)을 먼저 적용해 주세요." }, { status: 503 });
      throw currentResult.error;
    }
    const entitlement = resolveBusinessEntitlement(normalizeSubscriptions(subscriptions.data), placeId);
    const current = aggregateBusinessPerformance((currentResult.data ?? []) as BusinessPerformanceRpcRow[]);
    const previous = aggregateBusinessPerformance((previousResult.data ?? []) as BusinessPerformanceRpcRow[]);
    return NextResponse.json({
      placeId,
      period: { from: from.toISOString(), to: periodEnd.toISOString() },
      comparisonPeriod: { from: previousStart.toISOString(), to: previousEnd.toISOString() },
      entitlement,
      current,
      previous: entitlement.features.period_comparison ? previous : null,
      changes: entitlement.features.period_comparison ? performanceChanges(current, previous) : null,
      reports: reports.error ? [] : reports.data ?? [],
      limitations: ["길찾기 클릭은 방문 의향을 나타내며 실제 방문으로 확정하지 않습니다.", "광고 차단기와 네트워크 장애로 일부 행동이 누락될 수 있습니다.", "매출과 실제 방문자 수를 추정하지 않습니다."],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = businessErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function parseDate(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return new Date(new Date(fallback).setHours(0, 0, 0, 0));
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? new Date(new Date(fallback).setHours(0, 0, 0, 0)) : date;
}

function normalizeSubscriptions(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const value = row as Record<string, unknown>;
    const relation = Array.isArray(value.subscription_plans) ? value.subscription_plans[0] : value.subscription_plans;
    return { ...value, subscription_plans: relation as { code?: string; name?: string; features?: Record<string, unknown> } | null };
  });
}
