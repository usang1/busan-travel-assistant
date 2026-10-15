import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/business-auth";
import { searchOfficialPlacesCached } from "@/lib/place-search";
import { isValidCoordinates } from "@/lib/location";

export const dynamic = "force-dynamic";

const requests = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser(request);
    enforceRateLimit(user.id);
    const body = await request.json().catch(() => null) as { query?: string; latitude?: number; longitude?: number } | null;
    const coordinates = { latitude: Number(body?.latitude), longitude: Number(body?.longitude) };
    const result = await searchOfficialPlacesCached(
      typeof body?.query === "string" ? body.query : "",
      isValidCoordinates(coordinates) ? coordinates : null,
    );
    return NextResponse.json(result);
  } catch (error) {
    const value = error as { status?: number; expose?: boolean; message?: string };
    const status = Number.isFinite(value.status) ? Number(value.status) : 500;
    const message = value.expose === true || status < 500 ? value.message : "장소 검색 중 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status });
  }
}

function enforceRateLimit(userId: string) {
  const now = Date.now();
  const current = requests.get(userId);
  if (!current || current.resetAt <= now) {
    requests.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 20) throw Object.assign(new Error("장소 검색 요청이 많습니다. 1분 후 다시 시도해 주세요."), { status: 429, expose: true });
  current.count += 1;
}
