import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/business-auth";
import { geocodeAddressOnServer, reverseGeocodeOnServer } from "@/lib/location-geocoding";

export const dynamic = "force-dynamic";

type RateEntry = { count: number; resetAt: number };
const rateEntries = new Map<string, RateEntry>();
const rateLimit = 30;
const rateWindowMs = 60_000;

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    enforceRateLimit(user.id);
    const body = await request.json().catch(() => null) as {
      mode?: "forward" | "reverse";
      query?: string;
      latitude?: number;
      longitude?: number;
    } | null;

    if (body?.mode === "forward") {
      const results = await geocodeAddressOnServer(typeof body.query === "string" ? body.query : "");
      return NextResponse.json({ results });
    }

    if (body?.mode === "reverse") {
      const result = await reverseGeocodeOnServer({
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
      });
      return NextResponse.json({ result });
    }

    return NextResponse.json({ message: "지원하지 않는 주소 변환 요청입니다." }, { status: 400 });
  } catch (error) {
    const value = error as { status?: number; expose?: boolean; message?: string; code?: string };
    const status = Number.isFinite(value.status) ? Number(value.status) : value.code === "login_required" ? 401 : 500;
    const message = value.expose === true || status < 500
      ? value.message || "주소 변환 요청에 실패했습니다."
      : "주소 변환 요청 중 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status });
  }
}

function enforceRateLimit(userId: string) {
  const now = Date.now();
  const current = rateEntries.get(userId);

  if (!current || current.resetAt <= now) {
    rateEntries.set(userId, { count: 1, resetAt: now + rateWindowMs });
    return;
  }

  if (current.count >= rateLimit) {
    throw Object.assign(new Error("주소 검색 요청이 많습니다. 1분 후 다시 시도해 주세요."), { status: 429, expose: true });
  }

  current.count += 1;
}
