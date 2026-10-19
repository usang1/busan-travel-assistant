import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { isUuid } from "@/lib/business-auth";
import { aggregateBusinessPerformance, businessRecommendations, performanceChanges, type BusinessPerformanceRpcRow } from "@/lib/business-performance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { const { client } = await requireAdmin(request); const { data, error } = await client.from("business_performance_reports").select("id,place_id,period_start,period_end,generated_at,data_version,places(name_ko)").order("generated_at", { ascending: false }).limit(100); if (error) { if (missing(error)) return NextResponse.json({ message: "리포트 DB 마이그레이션(055)을 먼저 적용해 주세요." }, { status: 503 }); throw error; } return NextResponse.json({ reports: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const body = await request.json().catch(() => null) as { placeId?: string; from?: string; to?: string } | null;
    if (!isUuid(body?.placeId)) return NextResponse.json({ message: "가게를 선택해 주세요." }, { status: 400 });
    const from = parseDate(body?.from); const to = parseDate(body?.to); const end = to ? new Date(to.getTime() + 86_400_000) : null;
    if (!from || !end || end <= from || end.getTime() - from.getTime() > 366 * 86_400_000) return NextResponse.json({ message: "올바른 리포트 기간을 선택해 주세요." }, { status: 400 });
    const duration = end.getTime() - from.getTime(); const previousStart = new Date(from.getTime() - duration);
    const [place, currentResult, previousResult] = await Promise.all([
      client.from("places").select("id,name_ko,slug,category,address_ko").eq("id", body.placeId).single(),
      client.rpc("get_business_place_performance", { target_place_id: body.placeId, period_start: from.toISOString(), period_end: end.toISOString() }),
      client.rpc("get_business_place_performance", { target_place_id: body.placeId, period_start: previousStart.toISOString(), period_end: from.toISOString() }),
    ]);
    if (place.error || currentResult.error || previousResult.error) throw place.error ?? currentResult.error ?? previousResult.error;
    const current = aggregateBusinessPerformance((currentResult.data ?? []) as BusinessPerformanceRpcRow[]);
    const previous = aggregateBusinessPerformance((previousResult.data ?? []) as BusinessPerformanceRpcRow[]);
    const recommendations = businessRecommendations(current);
    const snapshot = { place: { ...place.data, name: place.data.name_ko }, period: { from: from.toISOString(), to: end.toISOString() }, comparisonPeriod: { from: previousStart.toISOString(), to: from.toISOString() }, current, previous, changes: performanceChanges(current, previous), limitations: ["광고 차단기와 네트워크 장애로 일부 이벤트가 누락될 수 있습니다.", "길찾기 클릭은 방문 의향이며 실제 방문이 아닙니다.", "검증된 결제 데이터가 없어 매출과 ROI를 산출하지 않습니다."] };
    const { data, error } = await client.from("business_performance_reports").insert({ place_id: body.placeId, period_start: from.toISOString(), period_end: end.toISOString(), comparison_start: previousStart.toISOString(), comparison_end: from.toISOString(), snapshot, recommendations, generated_by: user.id }).select("id,place_id,period_start,period_end,generated_at").single();
    if (error) throw error;
    return NextResponse.json({ report: data, message: "가게 성과 리포트 스냅샷을 생성했습니다." });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}
function parseDate(value?: string) { if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null; const date = new Date(`${value}T00:00:00+09:00`); return Number.isNaN(date.getTime()) ? null : date; }
function missing(error: { code?: string }) { return error.code === "42P01" || error.code === "PGRST205"; }
