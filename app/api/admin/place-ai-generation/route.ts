import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { buildPreparedAiGenerationResponse } from "@/lib/place-ai/content-draft";
import type { PlaceAiGenerationRequest } from "@/types/place-ai";

export const dynamic = "force-dynamic";

function generationError(message: string, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as Partial<PlaceAiGenerationRequest>;

    if (!body.source_data?.name?.trim()) {
      throw generationError("AI 생성 준비에는 장소명이 필요합니다.");
    }

    if (!body.source_data.category) {
      throw generationError("AI 생성 준비에는 카테고리가 필요합니다.");
    }

    const response = buildPreparedAiGenerationResponse({
      source_data: body.source_data,
      locale_targets: body.locale_targets?.length ? body.locale_targets : ["ko", "zh", "en", "ja"],
      existing_content: body.existing_content,
    });

    return NextResponse.json(response);
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
