import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { resolveMapUrlCached } from "@/lib/map-url-resolver";
import { generateAdminPlaceSummaryCached } from "@/lib/place-ai/admin-summary";
import { buildPlaceSourceDataFromNormalizedPlace } from "@/lib/place-ai/content-draft";
import { generatePlaceAiContent } from "@/lib/place-ai/generator";

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
    let koreanContent: {
      description: string;
      travelTip: string;
      failedFields: string[];
      message: string;
    } | null = null;
    let koreanContentError = "";

    if (process.env.OPENAI_API_KEY) {
      const summaryPromise = generateAdminPlaceSummaryCached(resolution.normalizedPlace);
      const koreanContentPromise = Promise.resolve().then(async () => {
        const sourceData = buildPlaceSourceDataFromNormalizedPlace(resolution.normalizedPlace);

        if (!sourceData) {
          throw new Error("한국어 장소 설명을 만들 수 있는 provider 장소명 또는 카테고리가 없습니다.");
        }

        return generatePlaceAiContent({
          source_data: sourceData,
          locale_targets: ["ko"],
        });
      });
      const [summaryResult, koreanContentResult] = await Promise.allSettled([summaryPromise, koreanContentPromise]);

      if (summaryResult.status === "fulfilled") {
        adminSummary = summaryResult.value;
      } else {
        adminSummaryError = summaryResult.reason instanceof Error ? summaryResult.reason.message : "AI 장소 요약 생성에 실패했습니다.";
      }

      if (koreanContentResult.status === "fulfilled") {
        const generated = koreanContentResult.value;
        const result = generated.locale_results.ko;
        koreanContent = {
          description: generated.generated_content.description_ko,
          travelTip: generated.generated_content.travel_tip_ko,
          failedFields: result.failed_fields,
          message: result.message,
        };
      } else {
        koreanContentError = koreanContentResult.reason instanceof Error ? koreanContentResult.reason.message : "한국어 장소 콘텐츠 생성에 실패했습니다.";
      }
    }

    return NextResponse.json({
      ...resolution,
      analysis,
      adminSummary,
      adminSummaryError,
      koreanContent,
      koreanContentError,
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
