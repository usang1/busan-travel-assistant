import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { isUuid } from "@/lib/business-auth";

export async function GET(request: Request) {
  try { const { client } = await requireAdmin(request); const { data, error } = await client.from("coupons").select("*,places(name_ko)").order("created_at", { ascending: false }); if (error) { if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "쿠폰 DB 마이그레이션(051)을 먼저 적용해 주세요." }, { status: 503 }); throw error; } return NextResponse.json({ coupons: data ?? [] }); }
  catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function POST(request: Request) {
  try { const { client, user } = await requireAdmin(request); const body = await request.json().catch(() => null) as { id?: string; decision?: string } | null; if (!isUuid(body?.id) || !["approved", "rejected"].includes(body?.decision || "")) return NextResponse.json({ message: "검수 요청을 확인해 주세요." }, { status: 400 }); const approved = body?.decision === "approved"; const { data, error } = await client.from("coupons").update({ status: approved ? "approved" : "rejected", active: approved, approved_by: user.id, approved_at: approved ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", body.id).eq("status", "pending_review").select("*").single(); if (error) throw error; return NextResponse.json({ coupon: data, message: approved ? "쿠폰을 승인했습니다." : "쿠폰을 반려했습니다." }); }
  catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}
