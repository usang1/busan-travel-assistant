import { NextResponse } from "next/server";
import { toPublicOpenAiError } from "@/lib/openai-errors";
import {
  getKoreanTranslationConfig,
  maxTranslationInputLength,
  translateToKorean,
} from "@/lib/openai-korean-translation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const config = getKoreanTranslationConfig();

  try {
    if (!config.configured) {
      throw publicRequestError("번역 서비스 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.", 503, "missing_api_key");
    }

    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    const sourceText = typeof body?.text === "string" ? body.text.trim() : "";

    if (!sourceText) {
      throw publicRequestError("번역할 문장을 입력해 주세요.", 400, "empty_input");
    }

    if (sourceText.length > maxTranslationInputLength) {
      throw publicRequestError(`번역할 문장은 ${maxTranslationInputLength}자 이하로 입력해 주세요.`, 400, "input_too_long");
    }

    const result = await translateToKorean(sourceText, requestId);

    return NextResponse.json(
      {
        translation: result.translation,
        detectedLanguage: result.detectedLanguage,
        provider: "openai",
        model: result.model,
        requestId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const publicError = toPublicOpenAiError(error, "AI 번역");
    const record = error && typeof error === "object" ? error as Record<string, unknown> : null;

    // eslint-disable-next-line no-console
    console.error("[translation:gpt-failed]", {
      requestId,
      model: config.model,
      status: typeof record?.status === "number" ? record.status : publicError.status,
      code: typeof record?.code === "string" ? record.code : publicError.code,
      message: error instanceof Error ? error.message : "Unknown translation error",
    });

    return NextResponse.json(
      { message: publicError.message, requestId },
      { status: publicError.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function publicRequestError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, expose: true as const, code });
}
