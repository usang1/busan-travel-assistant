import { NextResponse } from "next/server";
import { businessErrorResponse, isUuid, requireAuthenticatedUser } from "@/lib/business-auth";

export async function GET(request: Request) {
  try {
    const { client, user } = await requireAuthenticatedUser(request);
    const memberships = await client.from("business_place_memberships").select("place_id").eq("user_id", user.id).eq("status", "active");
    if (memberships.error) throw memberships.error;
    const placeIds = (memberships.data ?? []).map((item) => item.place_id);
    if (!placeIds.length) return NextResponse.json({ coupons: [] });
    const { data, error } = await client.from("coupons").select("*,coupon_issues(id,status,issued_at,redeemed_at)").in("place_id", placeIds).order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "쿠폰 DB 마이그레이션(051)을 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    const coupons = (data ?? []).map((coupon) => {
      const issues = Array.isArray(coupon.coupon_issues) ? coupon.coupon_issues : [];
      return { ...coupon, issued_count: issues.length, redeemed_count: issues.filter((issue: { status?: string }) => issue.status === "redeemed").length, coupon_issues: undefined };
    });
    return NextResponse.json({ coupons });
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
    const discountType = ["amount", "percentage", "free_item", "other"].includes(String(body?.discountType)) ? String(body?.discountType) : "other";
    const discountValue = decimal(body?.discountValue, 100_000_000);
    if ((discountType === "amount" || discountType === "percentage") && !discountValue) return NextResponse.json({ message: "할인 금액 또는 비율을 입력해 주세요." }, { status: 400 });
    if (discountType === "percentage" && Number(discountValue) > 100) return NextResponse.json({ message: "할인 비율은 100% 이하여야 합니다." }, { status: 400 });
    const payload = {
      place_id: placeId, name, benefit_text: benefitText,
      discount_type: discountType, discount_value: discountType === "free_item" || discountType === "other" ? null : discountValue,
      minimum_order_amount: decimal(body?.minimumOrderAmount, 100_000_000), terms_text: text(body?.termsText, 1000), image_url: safeUrl(body?.imageUrl),
      valid_from: validFrom.toISOString(), valid_until: validUntil.toISOString(), daily_start: time(body?.dailyStart), daily_end: time(body?.dailyEnd),
      issue_limit: positiveInteger(body?.issueLimit, 1_000_000), per_user_limit: positiveInteger(body?.perUserLimit, 20) || 1,
      per_user_redemption_limit: positiveInteger(body?.perUserRedemptionLimit, 20) || 1,
      status: submit ? "pending_review" : "draft", active: false, rejection_reason: null, updated_at: new Date().toISOString(),
    };
    const couponId = typeof body?.id === "string" && isUuid(body.id) ? body.id : "";
    const result = couponId
      ? await client.from("coupons").update(payload).eq("id", couponId).eq("created_by", user.id).eq("status", "draft").select("*").single()
      : await client.from("coupons").insert({ ...payload, created_by: user.id }).select("*").single();
    if (result.error) throw result.error;
    return NextResponse.json({ coupon: result.data, message: submit ? "관리자 검수를 요청했습니다." : "쿠폰 초안을 저장했습니다." });
  } catch (error) { const response = businessErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function PATCH(request: Request) {
  try {
    const { client, user } = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null) as { id?: string; action?: string } | null;
    if (!isUuid(body?.id) || !["pause", "resume", "end"].includes(body?.action || "")) return NextResponse.json({ message: "쿠폰과 작업을 확인해 주세요." }, { status: 400 });
    const owned = await client.from("coupons").select("id,place_id,status,active,valid_until").eq("id", body.id).maybeSingle();
    if (owned.error || !owned.data) return NextResponse.json({ message: "본인 가게의 쿠폰만 관리할 수 있습니다." }, { status: 403 });
    const membership = await client.from("business_place_memberships").select("place_id").eq("place_id", owned.data.place_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (membership.error || !membership.data) return NextResponse.json({ message: "본인 가게의 쿠폰만 관리할 수 있습니다." }, { status: 403 });
    const now = new Date().toISOString();
    const update = body.action === "pause"
      ? { status: "paused", active: false, paused_at: now, updated_at: now }
      : body.action === "end"
        ? { status: "ended", active: false, ended_at: now, updated_at: now }
        : { status: "approved", active: true, paused_at: null, updated_at: now };
    if (body.action === "resume" && (owned.data.status !== "paused" || new Date(owned.data.valid_until) <= new Date())) return NextResponse.json({ message: "일시중지 상태이며 유효기간이 남은 쿠폰만 다시 게시할 수 있습니다." }, { status: 409 });
    if (body.action !== "resume" && owned.data.status !== "approved" && owned.data.status !== "paused") return NextResponse.json({ message: "게시 중이거나 일시중지된 쿠폰만 상태를 변경할 수 있습니다." }, { status: 409 });
    const result = await client.from("coupons").update(update).eq("id", body.id).select("*").single();
    if (result.error) throw result.error;
    return NextResponse.json({ coupon: result.data, message: body.action === "pause" ? "쿠폰을 일시중지했습니다." : body.action === "end" ? "쿠폰을 종료했습니다." : "쿠폰 게시를 재개했습니다." });
  } catch (error) { const response = businessErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validDate(value: unknown) { const date = typeof value === "string" ? new Date(value) : new Date(Number.NaN); return Number.isNaN(date.getTime()) ? null : date; }
function time(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value) ? `${value}:00` : null; }
function positiveInteger(value: unknown, maximum: number) { const result = Number(value); return Number.isInteger(result) && result > 0 ? Math.min(result, maximum) : null; }
function decimal(value: unknown, maximum: number) { if (value === "" || value === null || value === undefined) return null; const result = Number(value); return Number.isFinite(result) && result > 0 && result <= maximum ? Math.round(result * 100) / 100 : null; }
function safeUrl(value: unknown) { if (typeof value !== "string" || !value.trim()) return null; try { const url = new URL(value.trim()); return url.protocol === "https:" ? url.toString().slice(0, 2000) : null; } catch { return null; } }
