import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { resolveMapUrlCached } from "@/lib/map-url-resolver";
import { generateAdminPlaceSummaryCached } from "@/lib/place-ai/admin-summary";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { url?: string };
    const inputUrl = body.url?.trim();

    if (!inputUrl) {
      return NextResponse.json({ message: "지도 링크를 먼저 입력해 주세요." }, { status: 400 });
    }

    const resolution = await resolveMapUrlCached(inputUrl);
    const analysis = resolution.analysis;
    let adminSummary: Awaited<ReturnType<typeof generateAdminPlaceSummaryCached>> | null = null;
    let adminSummaryError = "";

    if (process.env.OPENAI_API_KEY) {
      try {
        adminSummary = await generateAdminPlaceSummaryCached(resolution.normalizedPlace);
      } catch (error) {
        adminSummaryError = error instanceof Error ? error.message : "AI 장소 요약 생성에 실패했습니다.";
      }
    }

    return NextResponse.json({
      ...resolution,
      analysis,
      adminSummary,
      adminSummaryError,
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
