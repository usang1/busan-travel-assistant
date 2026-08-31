import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { resolveMapUrlCached } from "@/lib/map-url-resolver";
import { generateAdminPlaceSummaryCached } from "@/lib/place-ai/admin-summary";
import { buildPlaceSourceDataFromNormalizedPlace } from "@/lib/place-ai/content-draft";
import { generatePlaceAiContent } from "@/lib/place-ai/generator";
import { createPlaceDraft, getMissingPlaceFields, mergePlaceData } from "@/lib/place-draft";
import { searchMissingPlaceDataCached, type PlaceWebSearchResult } from "@/lib/place-web-search";

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
    const providerDraft = createPlaceDraft(resolution.normalizedPlace);
    const missingFields = getMissingPlaceFields(providerDraft);
    let normalizedPlace = mergePlaceData(resolution.normalizedPlace, null).normalizedPlace;
    let webSearch: PlaceWebSearchResult | null = null;
    let webSearchError = "";

    if (missingFields.length > 0 && process.env.OPENAI_API_KEY?.trim()) {
      try {
        webSearch = await searchMissingPlaceDataCached(providerDraft, missingFields);
        normalizedPlace = mergePlaceData(normalizedPlace, webSearch.data).normalizedPlace;
      } catch (error) {
        webSearchError = error instanceof Error ? error.message : "Web Search 보완에 실패했습니다.";
        // Provider facts remain usable when web search is unavailable.
        // eslint-disable-next-line no-console
        console.warn("[place:web-search] enrichment failed", {
          provider: resolution.provider,
          missingFields,
          message: webSearchError,
        });
      }
    }

    const webSearchNotice = webSearchError
      ? `Web Search 보완 실패: ${webSearchError} Provider 정보만 사용합니다.`
      : webSearch?.needsReviewFields.length
        ? `Web Search 결과 중 ${webSearch.needsReviewFields.join(", ")}는 신뢰도가 낮아 자동 반영하지 않았습니다.`
        : "";
    const providerLookup = {
      ...resolution.providerLookup,
      message: [resolution.providerLookup.message, webSearchNotice].filter(Boolean).join(" "),
    };
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
      const summaryPromise = generateAdminPlaceSummaryCached(normalizedPlace);
      const koreanContentPromise = Promise.resolve().then(async () => {
        const sourceData = buildPlaceSourceDataFromNormalizedPlace(normalizedPlace);

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
      normalizedPlace,
      providerLookup,
      analysis,
      missingFields,
      webSearch,
      webSearchError,
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
