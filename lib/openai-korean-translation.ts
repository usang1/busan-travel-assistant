import "server-only";

type OpenAITranslationResponse = {
  id?: unknown;
  model?: unknown;
  output_text?: unknown;
  output?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

export type KoreanTranslationResult = {
  translation: string;
  detectedLanguage: string;
  model: string;
  responseId: string | null;
};

export const maxTranslationInputLength = 1000;
const defaultTranslationModel = "gpt-5-mini";

export function getKoreanTranslationConfig() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model:
      process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
      process.env.OPENAI_PLACE_MODEL?.trim() ||
      defaultTranslationModel,
  };
}

export async function translateToKorean(sourceText: string, requestId: string): Promise<KoreanTranslationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const { model } = getKoreanTranslationConfig();

  if (!apiKey) {
    throw exposedTranslationError("OPENAI_API_KEY가 설정되어 있지 않습니다.", 503, "missing_api_key");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "system",
          content: [
            "You are a professional interpreter helping a foreign traveler communicate with a Korean speaker.",
            "Translate the entire user message into natural, polite Korean.",
            "Preserve names, numbers, prices, addresses, dates, and the original intent exactly.",
            "Do not answer the message, explain the translation, add facts, or omit content.",
            "Detect the source language and return only the requested structured output.",
          ].join(" "),
        },
        {
          role: "user",
          content: sourceText,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "korean_translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              translation: { type: "string" },
              detectedLanguage: { type: "string" },
            },
            required: ["translation", "detectedLanguage"],
          },
        },
      },
      max_output_tokens: 1200,
    }),
    signal: AbortSignal.timeout(25000),
  });

  const body = (await response.json().catch(() => ({}))) as OpenAITranslationResponse;

  if (!response.ok) {
    const providerMessage = typeof body.error?.message === "string" ? body.error.message : "OpenAI 번역 요청에 실패했습니다.";
    const providerCode = typeof body.error?.code === "string" ? body.error.code : undefined;
    throw Object.assign(new Error(providerMessage), { status: response.status, code: providerCode });
  }

  const parsed = parseKoreanTranslationResponse(body);
  const resolvedModel = typeof body.model === "string" && body.model.trim() ? body.model : model;
  const responseId = typeof body.id === "string" && body.id.trim() ? body.id : null;

  // eslint-disable-next-line no-console
  console.info("[translation:gpt-success]", {
    requestId,
    responseId,
    model: resolvedModel,
    inputLength: sourceText.length,
  });

  return {
    ...parsed,
    model: resolvedModel,
    responseId,
  };
}

export function parseKoreanTranslationResponse(response: OpenAITranslationResponse) {
  const directText = typeof response.output_text === "string" ? response.output_text : "";
  const text = directText || findOutputText(response.output);

  if (!text) {
    throw exposedTranslationError("OpenAI 응답에서 번역 결과를 찾지 못했습니다.", 502, "missing_output");
  }

  let parsed: { translation?: unknown; detectedLanguage?: unknown };

  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw exposedTranslationError("OpenAI 번역 응답 형식이 올바르지 않습니다.", 502, "invalid_output");
  }

  const translation = typeof parsed.translation === "string" ? parsed.translation.trim() : "";
  const detectedLanguage = typeof parsed.detectedLanguage === "string" ? parsed.detectedLanguage.trim() : "";

  if (!translation) {
    throw exposedTranslationError("OpenAI가 유효한 한국어 번역을 반환하지 않았습니다.", 502, "empty_translation");
  }

  return {
    translation,
    detectedLanguage: detectedLanguage || "unknown",
  };
}

function findOutputText(output: unknown): string {
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = "content" in item ? item.content : null;

    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
    }
  }

  return "";
}

function exposedTranslationError(message: string, status: number, code: string) {
  return Object.assign(new Error(message), { status, expose: true as const, code });
}
