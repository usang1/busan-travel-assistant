import type { MapLinkAnalysisResult } from "@/lib/map-link-analysis";

export type PlaceSummaryDraft = {
  description_zh: string;
  description_ko: string;
  tips_zh: string;
  tips_ko: string;
};

type OpenAIResponse = {
  output_text?: unknown;
  output?: unknown;
  error?: {
    message?: string;
  };
};

const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_SUMMARY_MODEL || "gpt-5-mini";

export function canGeneratePlaceSummary() {
  return Boolean(openAiApiKey);
}

export async function generatePlaceSummaryDraft(analysis: MapLinkAnalysisResult): Promise<PlaceSummaryDraft | null> {
  if (!openAiApiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "system",
          content:
            "You write concise, practical place descriptions for a Busan travel admin. Use only the provided facts. Do not invent hours, menu, price, reviews, popularity, or amenities. Return valid JSON only.",
        },
        {
          role: "user",
          content: buildPlaceSummaryPrompt(analysis),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "place_summary_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              description_zh: { type: "string" },
              description_ko: { type: "string" },
              tips_zh: { type: "string" },
              tips_ko: { type: "string" },
            },
            required: ["description_zh", "description_ko", "tips_zh", "tips_ko"],
          },
        },
      },
      max_output_tokens: 700,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as OpenAIResponse;

  if (!response.ok) {
    throw new Error(body.error?.message || "OpenAI 설명 생성에 실패했습니다.");
  }

  return parsePlaceSummaryDraft(body);
}

export function buildPlaceSummaryPrompt(analysis: MapLinkAnalysisResult) {
  const facts = [
    `지도 provider: ${analysis.provider}`,
    `원본 링크: ${analysis.normalizedUrl || "미확인"}`,
    `최종 링크: ${analysis.resolvedUrl || "미확인"}`,
    `장소명: ${analysis.title || "미확인"}`,
    `지도 장소 ID: ${analysis.externalId || "미확인"}`,
    `좌표: ${
      typeof analysis.latitude === "number" && typeof analysis.longitude === "number"
        ? `${analysis.latitude}, ${analysis.longitude}`
        : "미확인"
    }`,
  ].join("\n");

  return [
    "아래 지도 링크 분석 결과만 근거로 관리자 입력용 설명 초안을 만들어라.",
    "",
    facts,
    "",
    "출력 규칙:",
    "- description_zh: 간체 중국어 1문장, 35자 이내. 중국인 자유여행객에게 유용하게.",
    "- description_ko: 한국어 1문장, 45자 이내. 관리자/한국어 상세용.",
    "- tips_zh: 간체 중국어 1문장, 45자 이내. 확인되지 않은 정보는 暂未确认이라고 표현.",
    "- tips_ko: 한국어 1문장, 55자 이내. 확인되지 않은 정보는 확인 필요라고 표현.",
    "- 장소명/위치/지도 링크에서 확인되는 정보만 사용.",
    "- 맛, 가격, 영업시간, 웨이팅, 결제, 메뉴, 리뷰 수는 제공되지 않으면 쓰지 말 것.",
  ].join("\n");
}

function parsePlaceSummaryDraft(response: OpenAIResponse): PlaceSummaryDraft {
  const directText = typeof response.output_text === "string" ? response.output_text : "";
  const text = directText || findOutputText(response.output);

  if (!text) {
    throw new Error("OpenAI 응답에서 설명 초안을 찾지 못했습니다.");
  }

  const parsed = JSON.parse(text) as Partial<PlaceSummaryDraft>;

  return {
    description_zh: sanitizeText(parsed.description_zh),
    description_ko: sanitizeText(parsed.description_ko),
    tips_zh: sanitizeText(parsed.tips_zh),
    tips_ko: sanitizeText(parsed.tips_ko),
  };
}

function findOutputText(output: unknown): string {
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    const itemRecord = asRecord(item);
    const content = itemRecord ? itemRecord.content : null;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      const contentRecord = asRecord(contentItem);
      const text = typeof contentRecord?.text === "string" ? contentRecord.text : "";

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 220) : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
