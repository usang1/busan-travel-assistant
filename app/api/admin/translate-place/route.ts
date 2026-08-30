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
      throw translateError("Vercel 환경변수에 OPENAI_API_KEY를 등록해야 AI 번역을 사용할 수 있습니다.");
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
