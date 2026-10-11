import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseMapUrl } from "@/lib/map-url";
import { createServerAnonClient, createServerServiceClient } from "@/lib/server-supabase";
import { sendBusinessApplicationNotification } from "@/lib/telegram";
import { isLocale } from "@/lib/i18n";

export const runtime = "nodejs";
const maxBytes = 20_000;

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await actor(request);
    const { data, error } = await client.from("business_applications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ applications: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return response(error); }
}

export async function POST(request: NextRequest) {
  try {
    if (new URL(request.url).origin !== request.headers.get("origin")) throw appError("cross_site_blocked", 403);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBytes) throw appError("request_too_large", 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const { client, user, profile } = await actor(request);
    if (profile.role !== "business_owner") throw appError("business_owner_required", 403);
    const storeName = text(body.storeName, 120); const address = text(body.address, 300);
    const category = text(body.category, 80); const contactName = text(body.contactName, 120);
    const contactEmail = text(body.contactEmail, 200); const contactPhone = text(body.contactPhone, 40);
    const relationship = text(body.relationship, 120); const notes = text(body.notes, 4000);
    if (!storeName || !address || !category || !contactName || (!contactEmail && !contactPhone) || !relationship || body.privacyConsent !== true) throw appError("invalid_application", 400);
    const parsed = parseMapUrl(text(body.mapUrl, 2000));
    if (body.mapUrl && parsed.provider === "unknown") throw appError("invalid_map_url", 400);
    const duplicateKey = createHash("sha256").update(`${storeName.trim().toLowerCase()}|${address.replace(/\s+/gu, "").toLowerCase()}`).digest("hex");
    const { data, error } = await client.from("business_applications").insert({
      user_id: user.id, locale: isLocale(String(body.locale)) ? body.locale : "ko", store_name: storeName, address, category,
      map_url: parsed.normalizedUrl || null, map_provider: parsed.sourceProvider, contact_name: contactName,
      contact_email: contactEmail || null, contact_phone: contactPhone || null, applicant_relationship: relationship,
      request_notes: notes, privacy_consent_at: new Date().toISOString(), duplicate_key: duplicateKey,
    }).select("id").single();
    if (error?.code === "23505") throw appError("duplicate_application", 409);
    if (error || !data) throw appError("application_save_failed", 500);
    let notificationStatus = "failed";
    try {
      const sent = await sendBusinessApplicationNotification({ applicationId: data.id, storeName, address, contactName });
      notificationStatus = sent.ok ? "sent" : sent.skipped ? "skipped" : "failed";
      const service = createServerServiceClient();
      await service.from("business_applications").update({ notification_status: notificationStatus, notification_attempts: 1, notification_last_attempt_at: new Date().toISOString(), notification_sent_at: sent.ok ? new Date().toISOString() : null, notification_last_error: sent.ok ? null : sent.skipped ? "missing_configuration" : "telegram_failed" }).eq("id", data.id);
    } catch (notificationError) { process.stderr.write(`[business-applications:telegram-failed] ${notificationError instanceof Error ? notificationError.name : "unknown"}\n`); }
    return NextResponse.json({ application: { id: data.id }, notification: notificationStatus }, { status: 201 });
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
  return { client, user: data.user, profile };
}
function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function appError(message: string, status: number) { return Object.assign(new Error(message), { status }); }
function response(error: unknown) { const value = error as { message?: string; status?: number }; return NextResponse.json({ message: value.message ?? "application_failed" }, { status: value.status ?? 500 }); }
