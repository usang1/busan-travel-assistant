import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { generateAdminPlaceSummary } from "@/lib/place-ai/admin-summary";
import type { NormalizedPlace } from "@/lib/place-providers/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > 32_000) {
      return NextResponse.json({ message: "AI 장소 요약 요청이 너무 큽니다." }, { status: 413 });
    }

    const body = (await request.json()) as { normalizedPlace?: NormalizedPlace };
    if (!body.normalizedPlace || JSON.stringify(body).length > 32_000) {
      return NextResponse.json({ message: "정규화된 장소 사실정보가 필요합니다." }, { status: 400 });
    }

    const result = await generateAdminPlaceSummary(body.normalizedPlace);
    return NextResponse.json(result);
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
