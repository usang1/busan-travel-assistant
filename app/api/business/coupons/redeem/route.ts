import { NextResponse } from "next/server";
import { businessErrorResponse, requireAuthenticatedUser } from "@/lib/business-auth";

export async function POST(request: Request) {
  try {
    const { client } = await requireAuthenticatedUser(request);
    const body = await request.json().catch(() => null) as { token?: string } | null;
    if (!body?.token || !/^[0-9a-f-]{36}$/iu.test(body.token)) return NextResponse.json({ message: "쿠폰 인증코드를 확인해 주세요." }, { status: 400 });
    const { data, error } = await client.rpc("redeem_coupon", { issue_token: body.token });
    if (error) return NextResponse.json({ message: redeemError(error.message) }, { status: /already|expired|ownership|unavailable/iu.test(error.message) ? 409 : 503 });
    const redemption = Array.isArray(data) ? data[0] : data;
    await client.from("place_action_events").insert({ place_id: redemption?.place_id, event_type: "coupon_redeemed", locale: "ko", metadata: { coupon_id: redemption?.coupon_id } });
    return NextResponse.json({ redemption, message: "쿠폰 사용을 확인했습니다." });
  } catch (error) { const response = businessErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

function redeemError(value: string) { if (/already_used/iu.test(value)) return "이미 사용된 쿠폰입니다."; if (/expired/iu.test(value)) return "만료된 쿠폰입니다."; if (/ownership/iu.test(value)) return "다른 가게의 쿠폰이거나 처리 권한이 없습니다."; if (/not_found/iu.test(value)) return "쿠폰을 찾을 수 없습니다."; return "쿠폰을 사용할 수 없습니다."; }
