import { NextResponse } from "next/server";
import { businessErrorResponse, requireAuthenticatedUser } from "@/lib/business-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { client, user } = await requireAuthenticatedUser(request);
    const { data, error } = await client.from("coupon_issues")
      .select("id,public_token,status,issued_at,expires_at,redeemed_at,coupons(id,name,benefit_text,terms_text,place_id,places(name_ko,slug))")
      .eq("user_id", user.id).order("issued_at", { ascending: false }).limit(100);
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return NextResponse.json({ message: "쿠폰 DB 마이그레이션(051, 055)을 먼저 적용해 주세요." }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ coupons: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = businessErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
