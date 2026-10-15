import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { publicPlacesCacheTag } from "@/lib/cache-tags";
import {
  isManagedPlaceField,
  isVerificationStatus,
  managedPlaceFields,
  type PlaceFieldSourceType,
  type PlaceVerificationApproval,
} from "@/lib/place-field-verification";

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const sourceTypes = new Set<PlaceFieldSourceType>(["map_api", "official_website", "official_menu", "owner", "admin", "field_visit", "csv", "manual"]);
const approvals = new Set<PlaceVerificationApproval>(["pending", "approved", "rejected"]);

export async function GET(request: Request, context: Context) {
  try {
    const { client } = await requireAdmin(request);
    const id = await placeId(context);
    const [fields, sources, visits, history, rules] = await Promise.all([
      client.from("place_field_verifications").select("*").eq("place_id", id).order("field_name"),
      client.from("place_data_sources").select("id,source_type,provider,external_id,source_url,collected_at").eq("place_id", id).order("collected_at", { ascending: false }),
      client.from("place_verification_visits").select("*").eq("place_id", id).order("visited_on", { ascending: false }),
      client.from("place_change_history").select("*").eq("place_id", id).order("changed_at", { ascending: false }).limit(100),
      client.from("place_verification_field_rules").select("*").order("field_name"),
    ]);
    const failure = [fields, sources, visits, history, rules].find((result) => result.error)?.error;
    if (failure) throw schemaError(failure);
    const visitIds = (visits.data ?? []).map((visit) => visit.id);
    const photos = visitIds.length
      ? await client.from("place_verification_photos").select("*").in("visit_id", visitIds).order("created_at", { ascending: false })
      : { data: [], error: null };
    if (photos.error) throw schemaError(photos.error);
    const ruleMap = new Map((rules.data ?? []).map((rule) => [rule.field_name, rule]));
    const effectiveFields = (fields.data ?? []).map((field) => {
      const rule = ruleMap.get(field.field_name);
      const reference = field.verified_at ?? field.updated_at;
      const expiresAt = rule?.enabled && reference ? new Date(new Date(reference).getTime() + rule.stale_after_days * 86_400_000).toISOString() : null;
      return { ...field, effective_status: expiresAt && expiresAt < new Date().toISOString() ? "needs_recheck" : field.verification_status, expires_at: expiresAt };
    });
    return NextResponse.json({
      fields: effectiveFields, sources: sources.data ?? [], visits: visits.data ?? [],
      photos: photos.data ?? [],
      history: history.data ?? [], rules: rules.data ?? [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { client, user } = await requireAdmin(request);
    const id = await placeId(context);
    const body = await request.json() as Record<string, unknown>;
    await assertPlaceExists(client, id);

    if (body.action === "bootstrap_auto") {
      const provider = safeText(body.provider, 40) || "manual";
      const sourceUrl = safeUrl(body.sourceUrl);
      const externalId = safeText(body.externalId, 200) || null;
      const collectedAt = safeDate(body.collectedAt) ?? new Date().toISOString();
      const rawFields = Array.isArray(body.fields) ? body.fields : [];
      const fields = rawFields.filter((item): item is { fieldName: string; value: unknown } => isRecord(item) && isManagedPlaceField(item.fieldName) && item.value !== undefined && item.value !== null && item.value !== "");
      if (!fields.length) throw publicError("자동 수집값이 없습니다.", 400);

      const { data: source, error: sourceError } = await client.from("place_data_sources").insert({
        place_id: id, source_type: provider === "manual" ? "manual" : "map_api", provider,
        external_id: externalId, source_url: sourceUrl, collected_at: collectedAt,
        collected_by: user.id, raw_snapshot: Object.fromEntries(fields.map((field) => [field.fieldName, field.value])),
      }).select("id").single();
      if (sourceError) throw schemaError(sourceError);
      const { data: existingFields, error: existingError } = await client.from("place_field_verifications").select("field_name,current_value,original_value,verification_status").eq("place_id", id).in("field_name", fields.map((field) => field.fieldName));
      if (existingError) throw schemaError(existingError);
      const existingMap = new Map((existingFields ?? []).map((field) => [field.field_name, field]));
      const protectedStatuses = new Set(["online_verified", "field_verified"]);
      const conflictRows = fields.filter((field) => { const existing = existingMap.get(field.fieldName); return existing && protectedStatuses.has(existing.verification_status) && !sameJson(existing.current_value, field.value); });
      for (const field of conflictRows) {
        const { error: conflictError } = await client.from("place_field_verifications").update({ has_conflict: true, conflicting_value: field.value, conflicting_source_id: source.id, updated_at: new Date().toISOString() }).eq("place_id", id).eq("field_name", field.fieldName);
        if (conflictError) throw schemaError(conflictError);
      }
      const rows = fields.filter((field) => !conflictRows.includes(field)).map((field) => ({
        place_id: id, field_name: field.fieldName, current_value: field.value,
        original_value: existingMap.get(field.fieldName)?.original_value ?? field.value, source_id: source.id,
        source_type: provider === "manual" ? "manual" : "map_api",
        source_url: sourceUrl, verification_status: "auto_imported",
        approval_status: "pending", is_public: false, verified_by: null, verified_at: null,
      }));
      if (rows.length) {
        const { error } = await client.from("place_field_verifications").upsert(rows, { onConflict: "place_id,field_name", ignoreDuplicates: false });
        if (error) throw schemaError(error);
      }
      return NextResponse.json({ ok: true, imported: rows.length, conflicts: conflictRows.length });
    }

    if (body.action === "upsert_field") {
      if (!isManagedPlaceField(body.fieldName)) throw publicError("검증 항목이 올바르지 않습니다.", 400);
      if (!isVerificationStatus(body.verificationStatus)) throw publicError("검증 상태가 올바르지 않습니다.", 400);
      const sourceType = String(body.sourceType ?? "manual") as PlaceFieldSourceType;
      const approval = String(body.approvalStatus ?? "pending") as PlaceVerificationApproval;
      if (!sourceTypes.has(sourceType) || !approvals.has(approval)) throw publicError("출처 또는 승인 상태가 올바르지 않습니다.", 400);
      const sourceUrl = safeUrl(body.sourceUrl);
      const visitId = typeof body.visitId === "string" && uuid.test(body.visitId) ? body.visitId : null;
      if (body.verificationStatus === "online_verified" && !sourceUrl) throw publicError("온라인 확인에는 출처 URL이 필요합니다.", 400);
      if (body.verificationStatus === "field_verified") {
        if (!visitId) throw publicError("직접 방문 확인에는 실제 방문 기록이 필요합니다.", 400);
        const { data: visit } = await client.from("place_verification_visits").select("id,actual_visit").eq("id", visitId).eq("place_id", id).maybeSingle();
        if (!visit?.actual_visit) throw publicError("실제 방문으로 기록된 검수만 현장 확인에 연결할 수 있습니다.", 409);
      }
      const verifiedStatuses = new Set(["online_verified", "owner_confirmed", "field_verified"]);
      const verifiedAt = verifiedStatuses.has(body.verificationStatus) ? safeDate(body.verifiedAt) ?? new Date().toISOString() : safeDate(body.verifiedAt);
      const { data: existing } = await client.from("place_field_verifications").select("original_value").eq("place_id", id).eq("field_name", body.fieldName).maybeSingle();
      const row = {
        place_id: id, field_name: body.fieldName, current_value: jsonValue(body.currentValue),
        original_value: existing?.original_value ?? jsonValue(body.currentValue), source_type: sourceType,
        source_url: sourceUrl, verification_status: body.verificationStatus, approval_status: approval,
        verified_by: verifiedAt ? user.id : null, verified_at: verifiedAt, visit_id: visitId,
        private_notes: safeText(body.privateNotes, 4000) || null,
        has_conflict: false, conflicting_value: null, conflicting_source_id: null,
        is_public: approval === "approved" && body.isPublic === true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client.from("place_field_verifications").upsert(row, { onConflict: "place_id,field_name" }).select("*").single();
      if (error) throw schemaError(error);
      revalidateTag(publicPlacesCacheTag, { expire: 0 });
      return NextResponse.json({ field: data });
    }

    if (body.action === "create_visit") {
      const visitedOn = dateOnly(body.visitedOn);
      if (!visitedOn || visitedOn > new Date().toISOString().slice(0, 10)) throw publicError("방문일이 올바르지 않습니다.", 400);
      const actualVisit = body.actualVisit === true;
      const checkedFields = Array.isArray(body.checkedFields) ? body.checkedFields.filter(isManagedPlaceField) : [];
      const { data: visit, error } = await client.from("place_verification_visits").insert({
        place_id: id, visited_on: visitedOn, visitor_id: user.id, actual_visit: actualVisit,
        visited_menu: safeText(body.visitedMenu, 1000) || null, checked_fields: checkedFields,
        advantages: safeText(body.advantages, 2000) || null, disadvantages: safeText(body.disadvantages, 2000) || null,
        overall_assessment: safeText(body.overallAssessment, 4000) || null,
        private_notes: safeText(body.privateNotes, 4000) || null,
      }).select("*").single();
      if (error) throw schemaError(error);
      const photos = Array.isArray(body.photos) ? body.photos.filter((value): value is string => typeof value === "string" && /^https?:\/\//iu.test(value)).slice(0, 20) : [];
      if (photos.length) {
        const { error: photoError } = await client.from("place_verification_photos").insert(photos.map((url) => ({ visit_id: visit.id, storage_url: url, created_by: user.id })));
        if (photoError) throw schemaError(photoError);
      }
      return NextResponse.json({ visit }, { status: 201 });
    }

    if (body.action === "update_rule") {
      if (!isManagedPlaceField(body.fieldName)) throw publicError("점검 항목이 올바르지 않습니다.", 400);
      const days = Number(body.staleAfterDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) throw publicError("점검 주기는 1~3650일이어야 합니다.", 400);
      const { error } = await client.from("place_verification_field_rules").upsert({ field_name: body.fieldName, stale_after_days: days, enabled: body.enabled !== false, updated_by: user.id, updated_at: new Date().toISOString() });
      if (error) throw schemaError(error);
      return NextResponse.json({ ok: true });
    }

    throw publicError("지원하지 않는 검증 작업입니다.", 400);
  } catch (error) {
    const response = adminErrorResponse(error);
    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

async function placeId(context: Context) { const { id } = await context.params; if (!uuid.test(id)) throw publicError("장소 ID가 올바르지 않습니다.", 400); return id; }
async function assertPlaceExists(client: Awaited<ReturnType<typeof requireAdmin>>["client"], id: string) { const { data, error } = await client.from("places").select("id").eq("id", id).maybeSingle(); if (error) throw error; if (!data) throw publicError("장소를 찾지 못했습니다.", 404); }
function publicError(message: string, status: number) { return Object.assign(new Error(message), { status, expose: true }); }
function schemaError(error: { code?: string; message?: string }) { if (["42P01", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "")) return publicError("장소 필드 검증 DB 마이그레이션(053)을 먼저 적용해 주세요.", 503); return error; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function safeText(value: unknown, limit: number) { return typeof value === "string" ? value.normalize("NFKC").trim().slice(0, limit) : ""; }
function safeUrl(value: unknown) { const text = safeText(value, 2000); if (!text) return null; try { const url = new URL(text); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { throw publicError("출처 URL이 올바르지 않습니다.", 400); } }
function safeDate(value: unknown) { if (typeof value !== "string" || !value.trim()) return null; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : null; }
function dateOnly(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null; }
function jsonValue(value: unknown) { if (value === undefined) return null; try { return JSON.parse(JSON.stringify(value)) as unknown; } catch { throw publicError("필드 값을 저장할 수 없습니다.", 400); } }
function sameJson(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }
