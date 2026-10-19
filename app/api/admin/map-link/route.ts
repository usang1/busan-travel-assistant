import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { resolveMapUrlCached } from "@/lib/map-url-resolver";
import { generateAdminPlaceSummaryCached } from "@/lib/place-ai/admin-summary";
import { createPlaceDraft, getMissingPlaceFields, mergePlaceData, type PlaceDraftField } from "@/lib/place-draft";
import { searchMissingPlaceData, searchMissingPlaceDataCached, type PlaceWebSearchHints, type PlaceWebSearchResult } from "@/lib/place-web-search";
import { buildAutofillFieldResults, buildFailedAutofillFieldResults, sanitizeAutofillFields, toDraftRetryFields, type PlaceAutofillDiagnostics, type PlaceAutofillField } from "@/lib/place-autofill";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = new Date();
  const runId = crypto.randomUUID();
  let logger: Awaited<ReturnType<typeof requireAdmin>> | null = null;
  let provider = "unknown";
  let retryOf: string | undefined;
  let requestedFields: PlaceAutofillField[] = [];
  try {
    logger = await requireAdmin(request);
    const body = (await request.json()) as { url?: string; forceWebSearch?: boolean; searchHints?: PlaceWebSearchHints; retryFields?: unknown; retryOf?: string };
    const inputUrl = body.url?.trim();
    const forceWebSearch = body.forceWebSearch === true;
    const searchHints = sanitizeSearchHints(body.searchHints);
    const retryFields = sanitizeAutofillFields(body.retryFields);
    requestedFields = retryFields;
    retryOf = isUuid(body.retryOf) ? body.retryOf : undefined;

    if (!inputUrl) {
      throw Object.assign(new Error("지도 링크를 먼저 입력해 주세요."), { status: 400, expose: true, code: "MISSING_SOURCE_URL" });
    }

    const resolution = await resolveMapUrlCached(inputUrl);
    provider = resolution.provider;
    const providerDraft = createPlaceDraft(resolution.normalizedPlace);
    const missingFields = getMissingPlaceFields(providerDraft);
    const forcedWebSearchFields: PlaceDraftField[] = ["menu", "recommendedOrder", "priceRange"];
    const retryDraftFields = toDraftRetryFields(retryFields);
    const webSearchFields = retryDraftFields.length
      ? retryDraftFields
      : forceWebSearch
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

    const fieldResults = buildAutofillFieldResults({
      place: normalizedPlace,
      provider: resolution.provider,
      lookupFailed: Boolean(resolution.lookupError),
      webSearchAttempted: webSearchFields.length > 0,
      webSearchFailed: Boolean(webSearchError) || (webSearchFields.length > 0 && !process.env.OPENAI_API_KEY?.trim()),
      needsReviewFields: webSearchNeedsReviewFields,
      requestedFields: retryFields,
    });
    const diagnostics: PlaceAutofillDiagnostics = {
      runId,
      provider: resolution.provider,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      status: fieldResults.every((field) => field.status === "auto_filled") ? "success" : fieldResults.some((field) => field.status === "auto_filled" || field.status === "review_required") ? "partial" : "failed",
      ...(retryOf ? { retryOf } : {}),
      fieldResults,
    };
    await logAutofillRun(logger, diagnostics);

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
      autofillDiagnostics: diagnostics,
    });
  } catch (error) {
    const response = adminErrorResponse(error);
    if (logger) {
      await logAutofillRun(logger, {
        runId,
        provider,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        status: "failed",
        errorCode: errorCode(error),
        ...(retryOf ? { retryOf } : {}),
        fieldResults: buildFailedAutofillFieldResults(provider, requestedFields),
      });
    }

    return NextResponse.json({ message: response.message, runId }, { status: response.status });
  }
}

async function logAutofillRun(context: Awaited<ReturnType<typeof requireAdmin>>, diagnostics: PlaceAutofillDiagnostics) {
  try {
    const { error } = await context.client.from("place_autofill_runs").insert({
      id: diagnostics.runId,
      requested_by: context.user.id,
      source_provider: diagnostics.provider,
      requested_at: diagnostics.startedAt,
      completed_at: new Date(new Date(diagnostics.startedAt).getTime() + diagnostics.durationMs).toISOString(),
      duration_ms: diagnostics.durationMs,
      status: diagnostics.status,
      error_code: diagnostics.errorCode ?? null,
      retry_of: diagnostics.retryOf ?? null,
      field_results: diagnostics.fieldResults,
    });
    if (error && !["42P01", "PGRST205"].includes(error.code ?? "")) {
      // eslint-disable-next-line no-console
      console.warn("[place:autofill-log] write failed", { runId: diagnostics.runId, code: error.code });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[place:autofill-log] unavailable", { runId: diagnostics.runId, code: errorCode(error) });
  }
}

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code.slice(0, 80);
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") return `HTTP_${error.status}`;
  return "AUTOFILL_FAILED";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
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
