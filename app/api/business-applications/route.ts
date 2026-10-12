import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseMapUrl } from "@/lib/map-url";
import { createServerAnonClient, createServerServiceClient } from "@/lib/server-supabase";
import { sendBusinessApplicationNotification } from "@/lib/telegram";
import { isLocale } from "@/lib/i18n";
import { validateBusinessApplicationInput } from "@/lib/business-application";

export const runtime = "nodejs";
const maxBytes = 20_000;

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await actor(request);
    const { data, error } = await client.from("business_applications").select("id,user_id,locale,store_name,address,category,contact_name,contact_phone,applicant_role,applicant_relationship,map_url,status,linked_place_id,admin_notes,reviewed_at,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ applications: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return response(error); }
}

export async function POST(request: NextRequest) {
  try {
    if (new URL(request.url).origin !== request.headers.get("origin")) throw appError("cross_site_blocked", 403);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBytes) throw appError("request_too_large", 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw appError("invalid_request", 400);
    }
    const { client, user } = await actor(request);
    const validation = validateBusinessApplicationInput({
      placeUrl: body.placeUrl,
      applicantName: body.applicantName,
      applicantRole: body.applicantRole,
      contactPhone: body.contactPhone,
      privacyConsent: body.privacyConsent,
      consentVersion: body.consentVersion,
    });
    if (!validation.ok) throw appError(validation.code, 400, validation.field);
    const input = validation.data;
    const parsed = parseMapUrl(input.placeUrl);
    const locale = isLocale(String(body.locale)) ? String(body.locale) : "ko";
    const submissionArgs = {
      request_locale: locale,
      place_url: input.placeUrl,
      place_external_id: parsed.placeId ?? null,
      applicant_name: input.applicantName,
      requested_applicant_role: input.applicantRole,
      contact_phone: input.contactPhone,
      accepted_consent_version: input.consentVersion,
      store_name_hint: parsed.title ?? null,
      address_hint: parsed.sharedAddress ?? null,
    };
    const { data, error } = await client.rpc("submit_business_application", submissionArgs);
    let applicationId: string;
    if (error) {
      if (error.code === "PGRST202" || /submit_business_application/iu.test(error.message ?? "")) {
        applicationId = await createLegacyCompatibleApplication(client, user.id, submissionArgs);
      } else {
        throw appError("application_save_failed", 500);
      }
    } else {
      const result = data as { ok?: boolean; code?: string; application_id?: string } | null;
      if (!result?.ok || !result.application_id) {
        if (result?.code === "duplicate_application") throw appError("duplicate_application", 409);
        if (result?.code === "rate_limited") throw appError("rate_limited", 429);
        throw appError(result?.code ?? "application_save_failed", result?.code?.startsWith("invalid_") ? 400 : 500);
      }
      applicationId = result.application_id;
    }
    let notificationStatus = "failed";
    try {
      const sent = await sendBusinessApplicationNotification({
        applicationId,
        placeUrl: input.placeUrl,
        applicantName: input.applicantName,
        applicantRole: input.applicantRole,
      });
      notificationStatus = sent.ok ? "sent" : sent.skipped ? "skipped" : "failed";
      const service = createServerServiceClient();
      await service.from("business_applications").update({ notification_status: notificationStatus, notification_attempts: 1, notification_last_attempt_at: new Date().toISOString(), notification_sent_at: sent.ok ? new Date().toISOString() : null, notification_last_error: sent.ok ? null : sent.skipped ? "missing_configuration" : "telegram_failed" }).eq("id", applicationId);
    } catch (notificationError) { process.stderr.write(`[business-applications:telegram-failed] ${notificationError instanceof Error ? notificationError.name : "unknown"}\n`); }
    return NextResponse.json({ application: { id: applicationId }, notification: notificationStatus }, { status: 201 });
  } catch (error) { return response(error); }
}

async function actor(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/iu, "");
  if (!token) throw appError("login_required", 401);
  const client = createServerAnonClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw appError("login_required", 401);
  const { data: profile } = await client.from("profiles").select("role, display_name, email").eq("id", data.user.id).single();
  if (!profile) throw appError("profile_required", 403);
  return { client, user: data.user };
}
function appError(code: string, status: number, field?: string) { return Object.assign(new Error(code), { code, status, field }); }
function response(error: unknown) {
  const value = error as { code?: string; status?: number; field?: string };
  const status = typeof value.status === "number" ? value.status : 500;
  const code = value.code ?? (status === 500 ? "application_failed" : "invalid_request");
  return NextResponse.json({ code, field: value.field, message: code }, { status });
}

async function createLegacyCompatibleApplication(
  client: Awaited<ReturnType<typeof createServerAnonClient>>,
  userId: string,
  input: {
    request_locale: string;
    place_url: string;
    place_external_id: string | null;
    applicant_name: string;
    requested_applicant_role: string;
    contact_phone: string;
    accepted_consent_version: string;
    store_name_hint: string | null;
    address_hint: string | null;
  },
): Promise<string> {
  const duplicateKey = createHash("sha256")
    .update(`NAVER|${input.place_external_id || input.place_url}`)
    .digest("hex");
  const { data: existing, error: duplicateLookupError } = await client
    .from("business_applications")
    .select("id")
    .eq("map_provider", "NAVER")
    .eq("map_url", input.place_url)
    .neq("status", "rejected")
    .limit(1);
  if (duplicateLookupError) throw appError("application_save_failed", 500);
  if (existing?.length) throw appError("duplicate_application", 409);

  const compatibilityMetadata = `__SPOTZARI_APPLICATION_META__:${JSON.stringify({
    applicant_role: input.requested_applicant_role,
    consent_version: input.accepted_consent_version,
  })}`;
  const { data, error } = await client.from("business_applications").insert({
    user_id: userId,
    locale: input.request_locale,
    store_name: (input.store_name_hint || "네이버 플레이스 업체").slice(0, 120),
    address: (input.address_hint || "네이버 플레이스 URL 확인 필요").slice(0, 300),
    category: "미확인",
    map_url: input.place_url,
    map_provider: "NAVER",
    contact_name: input.applicant_name,
    contact_email: null,
    contact_phone: input.contact_phone,
    applicant_relationship: input.requested_applicant_role,
    request_notes: compatibilityMetadata,
    privacy_consent_at: new Date().toISOString(),
    duplicate_key: duplicateKey,
  }).select("id").single();

  if (error?.code === "23505") throw appError("duplicate_application", 409);
  if (error?.code === "42501" || error?.code === "PGRST301") throw appError("migration_required", 503);
  if (error || !data) throw appError("application_save_failed", 500);

  return data.id as string;
}
