import { NextResponse } from "next/server";
import { createServerAnonClient } from "@/lib/server-supabase";
import { recordServerAnalyticsEvent } from "@/lib/server-analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const placeId = new URL(request.url).searchParams.get("placeId");
  if (!isUuid(placeId)) return NextResponse.json({ message: "장소를 확인해 주세요." }, { status: 400 });
  try {
    const client = createServerAnonClient();
    const { data, error } = await client.from("coupons").select("id,place_id,name,benefit_text,discount_type,discount_value,minimum_order_amount,terms_text,image_url,valid_from,valid_until,daily_start,daily_end,issue_limit,per_user_limit").eq("place_id", placeId).eq("status", "approved").eq("active", true).gt("valid_until", new Date().toISOString()).order("valid_until");
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ coupons: [], unavailable: true });
      throw error;
    }
    return NextResponse.json({ coupons: data ?? [] }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ message: "쿠폰을 불러오지 못했습니다." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1];
    if (!token) return NextResponse.json({ message: "쿠폰 발급은 로그인 후 이용할 수 있습니다." }, { status: 401 });
    const client = createServerAnonClient(token);
    const body = await request.json().catch(() => null) as { couponId?: string; visitId?: string } | null;
    if (!isUuid(body?.couponId) || !safeVisitId(body?.visitId)) return NextResponse.json({ message: "쿠폰 또는 방문 세션을 확인해 주세요." }, { status: 400 });
    const { data, error } = await client.rpc("issue_coupon", { target_coupon_id: body.couponId, visit_id: body.visitId });
    if (error) return NextResponse.json({ message: couponError(error.message) }, { status: /limit|sold_out|expired|outside/iu.test(error.message) ? 409 : 503 });
    const issue = Array.isArray(data) ? data[0] : data;
    const authenticated = await client.auth.getUser(token);
    const coupon = await client.from("coupons").select("place_id").eq("id", body.couponId).maybeSingle();
    if (coupon.data?.place_id) {
      await recordServerAnalyticsEvent({ eventName: "coupon_claim", legacyEventName: "coupon_issued", placeId: coupon.data.place_id, userId: authenticated.data.user?.id, anonymousSessionId: body.visitId, metadata: { coupon_id: body.couponId } });
    }
    return NextResponse.json({ issue: { token: issue?.public_token, expiresAt: issue?.expires_at, status: issue?.status } });
  } catch {
    return NextResponse.json({ message: "쿠폰 발급 중 오류가 발생했습니다." }, { status: 500 });
  }
}

function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value); }
function safeVisitId(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9][a-z0-9-]{7,119}$/iu.test(value); }
function couponError(value: string) { if (/login_required/iu.test(value)) return "쿠폰 발급은 로그인 후 이용할 수 있습니다."; if (/limit_reached/iu.test(value)) return "이 쿠폰의 사용자별 발급 한도에 도달했습니다."; if (/sold_out/iu.test(value)) return "쿠폰이 모두 발급되었습니다."; if (/expired/iu.test(value)) return "쿠폰 발급 기간이 종료되었습니다."; if (/outside_hours/iu.test(value)) return "현재는 쿠폰 발급 가능 시간이 아닙니다."; return "쿠폰을 발급할 수 없습니다."; }
