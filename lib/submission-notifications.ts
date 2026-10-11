import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPlaceSubmissionNotification } from "@/lib/telegram";

type NotificationStatus = "sent" | "failed" | "skipped";

export async function notifyPlaceSubmission(input: {
  submissionId: string | null;
  submitterLabel: string;
  client?: SupabaseClient | null;
  previousAttempts?: number;
}): Promise<{ status: NotificationStatus; recorded: boolean }> {
  let result: { ok: boolean; skipped: boolean };
  try {
    result = await sendPlaceSubmissionNotification({
      submitterLabel: input.submitterLabel,
      ...(input.submissionId ? { submissionId: input.submissionId } : {}),
    });
  } catch (error) {
    process.stderr.write(`[submissions:notification-send-failed] ${error instanceof Error ? error.name : "unknown"}\n`);
    result = { ok: false, skipped: false };
  }
  const status: NotificationStatus = result.ok ? "sent" : result.skipped ? "skipped" : "failed";

  if (!input.client || !input.submissionId) return { status, recorded: false };

  const attemptedAt = new Date().toISOString();
  try {
    const { data, error } = await input.client
      .from("place_submissions")
      .update({
        notification_status: status,
        notification_attempts: (input.previousAttempts ?? 0) + 1,
        notification_last_attempt_at: attemptedAt,
        notification_last_error: status === "sent" ? null : status === "skipped" ? "missing_configuration" : "telegram_failed",
        notification_sent_at: status === "sent" ? attemptedAt : null,
      })
      .eq("id", input.submissionId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("notification_status_not_recorded");
  } catch (error) {
    process.stderr.write(`[submissions:notification-status-write-failed] ${JSON.stringify({ submissionId: input.submissionId, code: error && typeof error === "object" && "code" in error ? error.code : "network_error" })}\n`);
    return { status, recorded: false };
  }
  return { status, recorded: true };
}
