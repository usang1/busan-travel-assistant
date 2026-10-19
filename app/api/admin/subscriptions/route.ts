import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { isUuid } from "@/lib/business-auth";
import { BUSINESS_PLAN_FEATURES } from "@/lib/business-entitlements";

export async function GET(request: Request) {
  try {
    const { client } = await requireAdmin(request);
    const [plans, subscriptions, owners] = await Promise.all([
      client.from("subscription_plans").select("*").order("sort_order"),
      client.from("business_subscriptions").select("*,subscription_plans(name,code),places(name_ko)").order("created_at", { ascending: false }),
      client.from("profiles").select("id,display_name,role").eq("role", "business_owner").order("display_name"),
    ]);
    const error = plans.error ?? subscriptions.error ?? owners.error;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "구독 DB 마이그레이션(051)을 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ plans: plans.data ?? [], subscriptions: subscriptions.data ?? [], owners: owners.data ?? [] });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (body?.action === "create_plan") {
      const code = safeCode(body.code); const name = text(body.name, 120);
      if (!code || !name) return NextResponse.json({ message: "요금제 코드와 이름을 입력해 주세요." }, { status: 400 });
      const allowed = new Set(Object.keys(BUSINESS_PLAN_FEATURES.free));
      const features = Array.isArray(body.features) ? Object.fromEntries(body.features.filter((item): item is string => typeof item === "string" && allowed.has(item.trim())).map((item) => [item.trim(), true])) : {};
      const { data, error } = await client.from("subscription_plans").insert({ code, name, description: text(body.description, 500), features, active: true }).select("*").single();
      if (error) throw error; return NextResponse.json({ plan: data, message: "요금제를 만들었습니다. 실제 결제는 연결되지 않았습니다." });
    }
    if (body?.action === "activate") {
      const businessUserId = typeof body.businessUserId === "string" ? body.businessUserId : "";
      const planId = typeof body.planId === "string" ? body.planId : "";
      const placeId = typeof body.placeId === "string" && isUuid(body.placeId) ? body.placeId : null;
      if (!isUuid(businessUserId) || !isUuid(planId)) return NextResponse.json({ message: "사업자와 요금제를 선택해 주세요." }, { status: 400 });
      const status = body.status === "trial" ? "trial" : "active";
      const endsAt = typeof body.endsAt === "string" && body.endsAt ? new Date(body.endsAt) : null;
      if (endsAt && Number.isNaN(endsAt.getTime())) return NextResponse.json({ message: "종료일을 확인해 주세요." }, { status: 400 });
      let previous = client.from("business_subscriptions").update({ status: "paused", updated_at: new Date().toISOString() }).eq("business_user_id", businessUserId).in("status", ["trial", "active"]);
      previous = placeId ? previous.eq("place_id", placeId) : previous.is("place_id", null);
      const paused = await previous;
      if (paused.error) throw paused.error;
      const { data, error } = await client.from("business_subscriptions").insert({ business_user_id: businessUserId, plan_id: planId, place_id: placeId, status, starts_at: new Date().toISOString(), ends_at: endsAt?.toISOString() ?? null, activation_source: "admin_manual", activated_by: user.id }).select("*").single();
      if (error) throw error; return NextResponse.json({ subscription: data, message: status === "trial" ? "체험 권한을 부여했습니다. 실제 과금은 발생하지 않았습니다." : "관리자 수동 플랜을 적용했습니다. 실제 과금은 발생하지 않았습니다." });
    }
    return NextResponse.json({ message: "지원하지 않는 구독 요청입니다." }, { status: 400 });
  } catch (error) { const value = error as { code?: string }; if (value.code === "23505") return NextResponse.json({ message: "이미 존재하는 요금제 또는 구독입니다." }, { status: 409 }); const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function safeCode(value: unknown) { const result = text(value, 80).toLowerCase(); return /^[a-z0-9][a-z0-9_-]{1,79}$/u.test(result) ? result : ""; }
