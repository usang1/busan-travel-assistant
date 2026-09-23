import "server-only";
import { emptySocialClues, type SocialDiscoveryClues } from "@/lib/social-discovery";

const maxImageBytes = 4 * 1024 * 1024;
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type OpenAIResponse = {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

export class SocialImageError extends Error {
  constructor(public readonly code: "invalid_image" | "image_too_large" | "ocr_unavailable" | "ocr_failed") {
    super(code);
  }
}

export function canAnalyzeSocialImage() {
  return process.env.SOCIAL_DISCOVERY_IMAGE_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function validateSocialImage(file: File, bytes: Uint8Array) {
  if (file.size <= 0 || file.size > maxImageBytes || bytes.byteLength > maxImageBytes) {
    throw new SocialImageError("image_too_large");
  }
  if (!acceptedMimeTypes.has(file.type) || !matchesMagicBytes(file.type, bytes)) {
    throw new SocialImageError("invalid_image");
  }
}

export async function extractSocialImageClues(file: File): Promise<SocialDiscoveryClues> {
  if (!canAnalyzeSocialImage()) throw new SocialImageError("ocr_unavailable");
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateSocialImage(file, bytes);
  const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_SOCIAL_DISCOVERY_MODEL || process.env.OPENAI_PLACE_MODEL || "gpt-5-mini",
        store: false,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Extract only text and visible place-identification clues from this travel screenshot.",
                "Do not infer or invent a business, address, price, menu, popularity, or location.",
                "Ignore usernames, profile details, faces, comments, and engagement counts.",
                "Return empty arrays for anything uncertain.",
              ].join(" "),
            },
            { type: "input_image", image_url: dataUrl, detail: "low" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "social_place_clues",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                korean_names: stringArraySchema,
                chinese_names: stringArraySchema,
                region_terms: stringArraySchema,
                station_terms: stringArraySchema,
                menu_terms: stringArraySchema,
                price_terms: stringArraySchema,
                sign_text: stringArraySchema,
                address_terms: stringArraySchema,
                landmark_terms: stringArraySchema,
                hashtags: stringArraySchema,
              },
              required: ["korean_names", "chinese_names", "region_terms", "station_terms", "menu_terms", "price_terms", "sign_text", "address_terms", "landmark_terms", "hashtags"],
            },
          },
        },
        max_output_tokens: 700,
      }),
    });
    const body = await response.json().catch(() => ({})) as OpenAIResponse;
    if (!response.ok) throw new SocialImageError("ocr_failed");
    return parseClues(readOutputText(body));
  } catch (error) {
    if (error instanceof SocialImageError) throw error;
    throw new SocialImageError("ocr_failed");
  } finally {
    clearTimeout(timeout);
  }
}

function parseClues(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const read = (key: string) => Array.isArray(parsed[key])
      ? (parsed[key] as unknown[]).filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 20)
      : [];
    return {
      ...emptySocialClues(),
      placeTerms: [...read("korean_names"), ...read("chinese_names")],
      regionTerms: read("region_terms"),
      stationTerms: read("station_terms"),
      menuTerms: read("menu_terms"),
      priceTerms: read("price_terms"),
      signText: read("sign_text"),
      addressTerms: read("address_terms"),
      landmarkTerms: read("landmark_terms"),
      hashtags: read("hashtags"),
    } satisfies SocialDiscoveryClues;
  } catch {
    throw new SocialImageError("ocr_failed");
  }
}

function readOutputText(body: OpenAIResponse) {
  if (typeof body.output_text === "string") return body.output_text;
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new SocialImageError("ocr_failed");
}

function matchesMagicBytes(mime: string, bytes: Uint8Array) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  return mime === "image/webp"
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

const stringArraySchema = { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 20 } as const;
