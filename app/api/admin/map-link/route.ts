import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { resolveMapUrlCached } from "@/lib/map-url-resolver";
import { generateAdminPlaceSummaryCached } from "@/lib/place-ai/admin-summary";
import { createPlaceDraft, getMissingPlaceFields, mergePlaceData, type PlaceDraftField } from "@/lib/place-draft";
import { searchMissingPlaceData, searchMissingPlaceDataCached, type PlaceWebSearchHints, type PlaceWebSearchResult } from "@/lib/place-web-search";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { url?: string; forceWebSearch?: boolean; searchHints?: PlaceWebSearchHints };
    const inputUrl = body.url?.trim();
    const forceWebSearch = body.forceWebSearch === true;
    const searchHints = sanitizeSearchHints(body.searchHints);

    if (!inputUrl) {
      return NextResponse.json({ message: "지도 링크를 먼저 입력해 주세요." }, { status: 400 });
    }

    const resolution = await resolveMapUrlCached(inputUrl);
    const providerDraft = createPlaceDraft(resolution.normalizedPlace);
    const missingFields = getMissingPlaceFields(providerDraft);
    const forcedWebSearchFields: PlaceDraftField[] = ["menu", "recommendedOrder", "priceRange"];
    const webSearchFields = forceWebSearch
      ? Array.from(new Set([...missingFields, ...forcedWebSearchFields]))
      : missingFields;
    let normalizedPlace = mergePlaceData(resolution.normalizedPlace, null).normalizedPlace;
    let webSearch: PlaceWebSearchResult | null = null;
    let webSearchError = "";
    let webSearchAcceptedFields: PlaceDraftField[] = [];
    let webSearchNeedsReviewFields: PlaceDraftField[] = [];

    if (webSearchFields.length > 0 && process.env.OPENAI_API_KEY?.trim()) {
      try {
        webSearch = forceWebSearch
          ? await searchMissingPlaceData(providerDraft, webSearchFields, searchHints)
          : await searchMissingPlaceDataCached(providerDraft, webSearchFields, searchHints);
        const mergeResult = mergePlaceData(normalizedPlace, webSearch.data, forceWebSearch ? forcedWebSearchFields : []);
        normalizedPlace = mergeResult.normalizedPlace;
        webSearchAcceptedFields = mergeResult.acceptedFields;
        webSearchNeedsReviewFields = mergeResult.needsReviewFields;
        if (!webSearch.identity.matched) {
          // eslint-disable-next-line no-console
          console.warn("[place:web-search] identity mismatch", {
            provider: resolution.provider,
            providerPlaceId: providerDraft.providerPlaceId,
            expectedName: providerDraft.name || searchHints.name,
            matchedName: webSearch.identity.name,
            reason: webSearch.identity.reason,
          });
        }
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
      : webSearch && !webSearch.identity.matched
        ? `Web Search 결과가 다른 장소일 가능성이 있어 반영하지 않았습니다. ${webSearch.identity.reason}`
      : webSearchNeedsReviewFields.length
        ? `Web Search에서 ${webSearchAcceptedFields.length}개 필드를 보완했습니다. ${webSearchNeedsReviewFields.join(", ")}는 근거 또는 신뢰도가 부족해 반영하지 않았습니다.`
        : webSearch
          ? webSearchAcceptedFields.length
            ? `Web Search에서 ${webSearchAcceptedFields.join(", ")} 정보를 보완했습니다.`
            : "Web Search를 실행했지만 추가로 확인된 정보가 없습니다."
          : webSearchFields.length > 0 && !process.env.OPENAI_API_KEY?.trim()
            ? "OPENAI_API_KEY가 없어 Web Search 보완을 실행하지 않았습니다."
            : "";
    const providerLookup = {
      ...resolution.providerLookup,
      message: [resolution.providerLookup.message, webSearchNotice].filter(Boolean).join(" "),
    };
    const analysis = resolution.analysis;
    let adminSummary: Awaited<ReturnType<typeof generateAdminPlaceSummaryCached>> | null = null;
    let adminSummaryError = "";

    if (process.env.OPENAI_API_KEY) {
      try {
        adminSummary = await generateAdminPlaceSummaryCached(normalizedPlace);
      } catch (error) {
        adminSummaryError = error instanceof Error ? error.message : "AI 장소 요약 생성에 실패했습니다.";
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
      webSearchAcceptedFields,
      webSearchNeedsReviewFields,
      webSearchMode: forceWebSearch ? "manual" : "automatic",
      adminSummary,
      adminSummaryError,
      koreanContent: null,
      koreanContentError: "",
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

function sanitizeSearchHints(value: PlaceWebSearchHints | undefined): PlaceWebSearchHints {
  if (!value || typeof value !== "object") return {};
  return {
    ...sanitizeSearchHint("name", value.name),
    ...sanitizeSearchHint("address", value.address),
    ...sanitizeSearchHint("category", value.category),
  };
}

function sanitizeSearchHint<Key extends keyof PlaceWebSearchHints>(key: Key, value: unknown) {
  return typeof value === "string" && value.trim() ? { [key]: value.trim().slice(0, 300) } : {};
}
