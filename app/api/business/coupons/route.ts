import { NextResponse } from "next/server";
import { businessErrorResponse, isUuid, requireAuthenticatedUser } from "@/lib/business-auth";

export async function GET(request: Request) {
  try {
    const { client } = await requireAuthenticatedUser(request);
    const { data, error } = await client.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "쿠폰 DB 마이그레이션(051)을 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ coupons: data ?? [] });
  } catch (error) { const response = businessErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const placeId = typeof body?.placeId === "string" ? body.placeId : "";
    if (!isUuid(placeId)) return NextResponse.json({ message: "관리할 가게를 선택해 주세요." }, { status: 400 });
    const membership = await client.from("business_place_memberships").select("place_id").eq("place_id", placeId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (membership.error || !membership.data) return NextResponse.json({ message: "본인 가게의 쿠폰만 관리할 수 있습니다." }, { status: 403 });
    const validFrom = validDate(body?.validFrom);
    const validUntil = validDate(body?.validUntil);
    const name = text(body?.name, 120);
    const benefitText = text(body?.benefitText, 500);
    if (!name || !benefitText || !validFrom || !validUntil || validUntil <= validFrom) return NextResponse.json({ message: "쿠폰명, 혜택, 올바른 유효기간을 입력해 주세요." }, { status: 400 });
    const submit = body?.submit === true;
    const payload = { place_id: placeId, name, benefit_text: benefitText, valid_from: validFrom.toISOString(), valid_until: validUntil.toISOString(), daily_start: time(body?.dailyStart), daily_end: time(body?.dailyEnd), issue_limit: positiveInteger(body?.issueLimit, 1_000_000), per_user_limit: positiveInteger(body?.perUserLimit, 20) || 1, status: submit ? "pending_review" : "draft", active: false, updated_at: new Date().toISOString() };
    const couponId = typeof body?.id === "string" && isUuid(body.id) ? body.id : "";
    const result = couponId
      ? await client.from("coupons").update(payload).eq("id", couponId).eq("created_by", user.id).eq("status", "draft").select("*").single()
      : await client.from("coupons").insert({ ...payload, created_by: user.id }).select("*").single();
    if (result.error) throw result.error;
    return NextResponse.json({ coupon: result.data, message: submit ? "관리자 검수를 요청했습니다." : "쿠폰 초안을 저장했습니다." });
  } catch (error) { const response = businessErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validDate(value: unknown) { const date = typeof value === "string" ? new Date(value) : new Date(Number.NaN); return Number.isNaN(date.getTime()) ? null : date; }
function time(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value) ? `${value}:00` : null; }
function positiveInteger(value: unknown, maximum: number) { const result = Number(value); return Number.isInteger(result) && result > 0 ? Math.min(result, maximum) : null; }
