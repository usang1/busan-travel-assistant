import "server-only";
import { absoluteUrl } from "@/config/site";

const telegramApiTimeoutMs = 3500;

type SendTelegramMessageInput = {
  text: string;
};

type PlaceSubmissionNotificationInput = {
  submitterLabel: string;
};

export async function sendTelegramMessage({ text }: SendTelegramMessageInput) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !chatId) {
    logTelegramError({
      reason: "missing_configuration",
      missing: [
        ...(!token ? ["TELEGRAM_BOT_TOKEN"] : []),
        ...(!chatId ? ["TELEGRAM_CHAT_ID"] : []),
      ],
    });
    return { ok: false, skipped: true as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), telegramApiTimeoutMs);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: sanitizeTelegramText(text),
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    const result = await readTelegramResponse(response);
    if (!response.ok || result.ok !== true) {
      logTelegramError({
        status: response.status,
        ok: result.ok,
        errorCode: result.error_code,
        description: result.description,
      });
      return { ok: false, skipped: false as const };
    }

    return { ok: true, skipped: false as const };
  } catch (error) {
    logTelegramError({
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return { ok: false, skipped: false as const };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendPlaceSubmissionNotification({
  submitterLabel,
}: PlaceSubmissionNotificationInput) {
  const reviewUrl = absoluteUrl("/admin#place-submissions");
  const text = [
    "새 장소 제보",
    `사용자: ${submitterLabel.trim() || "익명"}`,
    `검수 링크: ${reviewUrl}`,
  ].join("\n");

  return sendTelegramMessage({ text });
}

function logTelegramError(details: Record<string, unknown>) {
  process.stderr.write(`[telegram] Failed to send notification. ${JSON.stringify(details)}\n`);
}

async function readTelegramResponse(response: Response): Promise<{
  ok?: boolean;
  error_code?: number;
  description?: string;
}> {
  try {
    const body = await response.json();
    if (!body || typeof body !== "object") return {};
    const value = body as { ok?: unknown; error_code?: unknown; description?: unknown };
    return {
      ok: typeof value.ok === "boolean" ? value.ok : undefined,
      error_code: typeof value.error_code === "number" ? value.error_code : undefined,
      description: typeof value.description === "string" ? value.description.slice(0, 200) : undefined,
    };
  } catch {
    return {};
  }
}

function sanitizeTelegramText(value: string) {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 10 || code === 13 || code === 9 || (code >= 32 && code !== 127);
    })
    .join("")
    .slice(0, 3500);
}
