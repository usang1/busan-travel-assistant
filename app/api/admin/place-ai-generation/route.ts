import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import {
  assertPlaceAiRequestSize,
  generatePlaceAiContent,
  normalizePlaceAiGenerationRequest,
} from "@/lib/place-ai/generator";
import type { PlaceAiGenerationRequest, PlaceSourceData } from "@/types/place-ai";

export const dynamic = "force-dynamic";

type IncomingGenerationBody = Partial<PlaceAiGenerationRequest> & {
  sourceData?: PlaceSourceData;
  localeTargets?: PlaceAiGenerationRequest["locale_targets"];
  existingContent?: PlaceAiGenerationRequest["existing_content"];
};

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as IncomingGenerationBody;
    assertPlaceAiRequestSize(body);
    const generationRequest = normalizePlaceAiGenerationRequest(body);
    const response = await generatePlaceAiContent(generationRequest);

    return NextResponse.json(response);
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
