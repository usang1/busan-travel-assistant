import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { isUuid } from "@/lib/business-auth";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const { data, error } = await client.from("coupons").select("*,places(name_ko),coupon_issues(id,status,issued_at,expires_at,redeemed_at,user_id)").order("created_at", { ascending: false });
    if (error) { if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "쿠폰 DB 마이그레이션(051, 055)을 먼저 적용해 주세요." }, { status: 503 }); throw error; }
    const couponIds = (data ?? []).map((coupon) => coupon.id);
    const events = couponIds.length ? await client.from("coupon_redemption_events").select("id,issue_id,coupon_id,event_type,reason,occurred_at,actor_id").in("coupon_id", couponIds).order("occurred_at", { ascending: false }).limit(500) : { data: [], error: null };
    return NextResponse.json({ coupons: data ?? [], redemptionEvents: events.error ? [] : events.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const body = await request.json().catch(() => null) as { id?: string; decision?: string; reason?: string } | null;
    if (!isUuid(body?.id) || !["approved", "rejected"].includes(body?.decision || "")) return NextResponse.json({ message: "검수 요청을 확인해 주세요." }, { status: 400 });
    const approved = body.decision === "approved"; const reason = text(body.reason, 500);
    if (!approved && !reason) return NextResponse.json({ message: "반려 사유를 입력해 주세요." }, { status: 400 });
    const { data, error } = await client.from("coupons").update({ status: approved ? "approved" : "rejected", active: approved, approved_by: user.id, approved_at: approved ? new Date().toISOString() : null, rejection_reason: approved ? null : reason, updated_at: new Date().toISOString() }).eq("id", body.id).eq("status", "pending_review").select("*").single();
    if (error) throw error;
    return NextResponse.json({ coupon: data, message: approved ? "쿠폰을 승인했습니다." : "쿠폰을 반려했습니다." });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function PATCH(request: Request) {
  try {
    const { client } = await requireAdmin(request); const body = await request.json().catch(() => null) as { id?: string; action?: string } | null;
    if (!isUuid(body?.id) || !["pause", "resume", "end"].includes(body?.action || "")) return NextResponse.json({ message: "쿠폰과 작업을 확인해 주세요." }, { status: 400 });
    const now = new Date().toISOString(); const update = body.action === "pause" ? { status: "paused", active: false, paused_at: now, updated_at: now } : body.action === "end" ? { status: "ended", active: false, ended_at: now, updated_at: now } : { status: "approved", active: true, paused_at: null, updated_at: now };
    const { data, error } = await client.from("coupons").update(update).eq("id", body.id).select("*").single(); if (error) throw error;
    return NextResponse.json({ coupon: data, message: "쿠폰 상태를 변경했습니다." });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}
function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
