import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import {
  canGeneratePlaceSummary,
  generateAdminPlaceTranslations,
  type AdminTranslationFields,
} from "@/lib/openai-place-summary";

export const dynamic = "force-dynamic";

function translateError(message: string, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    if (!canGeneratePlaceSummary()) {
      throw translateError("AI 번역은 아직 비활성화되어 있습니다. 실제 연결 단계에서 OPENAI_API_KEY와 ADMIN_AI_API_ENABLED=true를 등록하세요.");
    }

    const body = (await request.json()) as { fields?: Partial<AdminTranslationFields> };
    const fields = body.fields ?? {};
    const hasSource = Object.values(fields).some((value) => typeof value === "string" && value.trim());

    if (!hasSource) {
      throw translateError("번역할 한국어/중국어/영어 텍스트를 먼저 입력해 주세요.");
    }

    const translations = await generateAdminPlaceTranslations(fields);

    return NextResponse.json({ translations });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}
