import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { placeCategories, type PlaceCategory } from "@/types/database";
import { isManagedPlaceField, type ManagedPlaceField } from "@/lib/place-field-verification";

const maxRows = 1000;
const maxBodyBytes = 2 * 1024 * 1024;
const mappingFields = ["name", "address", "latitude", "longitude", "category", "phone", "opening_hours", "external_id", "source"] as const;
type MappingField = (typeof mappingFields)[number];
type NormalizedRow = { name: string; address: string; latitude: number | null; longitude: number | null; category: PlaceCategory | null; phone: string; opening_hours: string; external_id: string; source: string };

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const template = "\uFEFF가게명,주소,위도,경도,카테고리,전화번호,영업시간,외부장소ID,출처\n예시 장소,부산광역시 수영구 예시로 1,35.1532,129.1187,restaurant,051-000-0000,매일 10:00-20:00,provider-id,official_api\n";
    return new NextResponse(template, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="spotzari-place-import-template.csv"' } });
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBodyBytes) throw publicError("CSV 요청은 2MB 이하여야 합니다.", 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.action === "preview") return preview(client, user.id, body);
    if (body.action === "commit") return commit(client, user.id, body);
    throw publicError("지원하지 않는 일괄 등록 작업입니다.", 400);
  } catch (error) { const response = adminErrorResponse(error); return NextResponse.json({ message: response.message }, { status: response.status }); }
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>["client"];

async function preview(client: AdminClient, userId: string, body: Record<string, unknown>) {
  const rows = Array.isArray(body.rows) ? body.rows.filter(isRecord).slice(0, maxRows) : [];
  if (!rows.length) throw publicError("미리 볼 CSV 행이 없습니다.", 400);
  const mapping = validateMapping(body.mapping);
  const filename = safeText(body.filename, 255) || "places.csv";
  const [{ data: places, error: placeError }, { data: sources, error: sourceError }] = await Promise.all([
    client.from("places").select("id,name_ko,address_ko,latitude,longitude").limit(10000),
    client.from("place_sources").select("place_id,external_id").not("external_id", "is", null).limit(10000),
  ]);
  if (placeError || sourceError) throw placeError ?? sourceError;
  const externalMap = new Map((sources ?? []).map((source) => [normalize(source.external_id), source.place_id]));
  const previewRows = rows.map((rawRow, index) => {
    const normalized = normalizeRow(rawRow, mapping);
    const errors = validateRow(normalized);
    const duplicate = errors.length ? null : findDuplicate(normalized, places ?? [], externalMap);
    return { rowNumber: index + 2, rawData: rawRow, normalizedData: normalized, status: errors.length ? "invalid" : duplicate ? "duplicate" : "valid", errors, duplicatePlaceId: duplicate?.id ?? null, duplicateName: duplicate?.name_ko ?? null };
  });
  const { data: batch, error: batchError } = await client.from("place_import_batches").insert({
    created_by: userId, original_filename: filename, column_mapping: mapping, status: "preview",
    total_rows: previewRows.length, valid_rows: previewRows.filter((row) => row.status === "valid").length,
    error_rows: previewRows.filter((row) => row.status === "invalid").length,
  }).select("id").single();
  if (batchError) throw schemaError(batchError);
  const { data: stored, error: rowError } = await client.from("place_import_rows").insert(previewRows.map((row) => ({
    batch_id: batch.id, row_number: row.rowNumber, raw_data: row.rawData, normalized_data: row.normalizedData,
    status: row.status, errors: row.errors, duplicate_place_id: row.duplicatePlaceId,
  }))).select("id,row_number,status,normalized_data,errors,duplicate_place_id").order("row_number");
  if (rowError) throw schemaError(rowError);
  return NextResponse.json({ batchId: batch.id, rows: (stored ?? []).map((row) => ({ ...row, duplicateName: previewRows.find((item) => item.rowNumber === row.row_number)?.duplicateName ?? null })) });
}

async function commit(client: AdminClient, userId: string, body: Record<string, unknown>) {
  const batchId = typeof body.batchId === "string" ? body.batchId : "";
  const selections = Array.isArray(body.selections) ? body.selections.filter(isRecord) : [];
  if (!/^[0-9a-f-]{36}$/iu.test(batchId) || !selections.length) throw publicError("등록할 행을 선택해 주세요.", 400);
  const selected = new Map(selections.map((item) => [String(item.rowId), item.action === "merge" ? "merge" : item.action === "create" ? "create" : "skip"]));
  const { data: rows, error } = await client.from("place_import_rows").select("*").eq("batch_id", batchId).in("id", [...selected.keys()]);
  if (error) throw schemaError(error);
  await client.from("place_import_batches").update({ status: "importing" }).eq("id", batchId);
  const results: Array<Record<string, unknown>> = [];
  let imported = 0; let skipped = 0; let failed = 0;
  for (const row of rows ?? []) {
    const action = selected.get(row.id) ?? "skip";
    try {
      if (action === "skip" || row.status === "invalid") { skipped += 1; await updateRow(client, row.id, "skipped", action); results.push(resultRow(row, "skipped")); continue; }
      const normalized = row.normalized_data as NormalizedRow;
      if (action === "merge") {
        if (!row.duplicate_place_id) throw new Error("연결할 중복 장소가 없습니다.");
        await attachProposal(client, userId, row.duplicate_place_id, normalized);
        imported += 1; await updateRow(client, row.id, "imported", action, row.duplicate_place_id); results.push(resultRow(row, "merged_for_review", row.duplicate_place_id)); continue;
      }
      if (row.status !== "valid") throw new Error("중복 행은 신규 생성할 수 없습니다.");
      const slug = `csv-${Date.now().toString(36)}-${row.row_number}-${crypto.randomUUID().slice(0, 8)}`;
      const { data: place, error: createError } = await client.from("places").insert({
        slug, name_ko: normalized.name, name_zh: normalized.name, category: normalized.category,
        address: normalized.address, address_ko: normalized.address, address_zh: normalized.address,
        latitude: normalized.latitude, longitude: normalized.longitude, phone: normalized.phone || null,
        opening_hours: normalized.opening_hours, status: "DRAFT", is_active: false,
      }).select("id").single();
      if (createError) throw createError;
      await attachProposal(client, userId, place.id, normalized);
      imported += 1; await updateRow(client, row.id, "imported", action, place.id); results.push(resultRow(row, "draft_created", place.id));
    } catch (caught) {
      failed += 1; const message = caught instanceof Error ? caught.message : "등록 실패";
      await client.from("place_import_rows").update({ status: "failed", errors: [...(row.errors ?? []), message], action }).eq("id", row.id);
      results.push(resultRow(row, "failed", null, message));
    }
  }
  const status = failed ? imported ? "partial" : "failed" : "completed";
  await client.from("place_import_batches").update({ status, imported_rows: imported, skipped_rows: skipped, error_rows: failed, completed_at: new Date().toISOString() }).eq("id", batchId);
  return NextResponse.json({ batchId, status, imported, skipped, failed, results });
}

async function attachProposal(client: AdminClient, userId: string, placeId: string, row: NormalizedRow) {
  const { data: source, error } = await client.from("place_data_sources").insert({ place_id: placeId, source_type: "csv", provider: row.source || "csv", external_id: row.external_id || null, collected_by: userId, raw_snapshot: row }).select("id").single();
  if (error) throw schemaError(error);
  const candidates: Array<[ManagedPlaceField, unknown]> = [["name", row.name], ["address", row.address], ["coordinates", row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : null], ["category", row.category], ["phone", row.phone], ["opening_hours", row.opening_hours]];
  const proposed = candidates.filter(([field, value]) => isManagedPlaceField(field) && value !== null && value !== "");
  const { data: existing, error: existingError } = await client.from("place_field_verifications").select("field_name,current_value,original_value,verification_status").eq("place_id", placeId).in("field_name", proposed.map(([field]) => field));
  if (existingError) throw schemaError(existingError);
  const existingMap = new Map((existing ?? []).map((field) => [field.field_name, field]));
  const protectedStatuses = new Set(["online_verified", "field_verified"]);
  const rows: Array<Record<string, unknown>> = [];
  for (const [field, value] of proposed) {
    const current = existingMap.get(field);
    if (current && protectedStatuses.has(current.verification_status) && JSON.stringify(current.current_value) !== JSON.stringify(value)) {
      const { error: conflictError } = await client.from("place_field_verifications").update({ has_conflict: true, conflicting_value: value, conflicting_source_id: source.id, updated_at: new Date().toISOString() }).eq("place_id", placeId).eq("field_name", field);
      if (conflictError) throw schemaError(conflictError);
    } else {
      rows.push({ place_id: placeId, field_name: field, current_value: value, original_value: current?.original_value ?? value, source_id: source.id, source_type: "csv", verification_status: "auto_imported", approval_status: "pending", is_public: false });
    }
  }
  if (rows.length) {
    const { error: fieldError } = await client.from("place_field_verifications").upsert(rows, { onConflict: "place_id,field_name" });
    if (fieldError) throw schemaError(fieldError);
  }
}

function validateMapping(value: unknown) { if (!isRecord(value)) throw publicError("CSV 컬럼 매핑이 필요합니다.", 400); const result: Partial<Record<MappingField, string>> = {}; for (const field of mappingFields) { const column = safeText(value[field], 120); if (column) result[field] = column; } if (!result.name || !result.address) throw publicError("가게명과 주소 컬럼은 필수입니다.", 400); return result; }
function normalizeRow(row: Record<string, unknown>, mapping: Partial<Record<MappingField, string>>): NormalizedRow { const read = (field: MappingField) => safeText(mapping[field] ? row[mapping[field]!] : "", 2000); return { name: read("name"), address: read("address"), latitude: numberOrNull(read("latitude")), longitude: numberOrNull(read("longitude")), category: placeCategories.includes(read("category") as PlaceCategory) ? read("category") as PlaceCategory : null, phone: read("phone"), opening_hours: read("opening_hours"), external_id: read("external_id"), source: read("source") }; }
function validateRow(row: NormalizedRow) { const errors: string[] = []; if (!row.name) errors.push("가게명 누락"); if (!row.address) errors.push("주소 누락"); if (!row.category) errors.push(`카테고리는 ${placeCategories.join(", ")} 중 하나여야 함`); if ((row.latitude === null) !== (row.longitude === null)) errors.push("위도·경도 쌍 누락"); if (row.latitude !== null && (row.latitude < -90 || row.latitude > 90)) errors.push("위도 범위 오류"); if (row.longitude !== null && (row.longitude < -180 || row.longitude > 180)) errors.push("경도 범위 오류"); return errors; }
function findDuplicate(row: NormalizedRow, places: Array<Record<string, unknown>>, externalMap: Map<string, unknown>) {
  const externalPlaceId = row.external_id ? externalMap.get(normalize(row.external_id)) : null;
  if (externalPlaceId) return places.find((place) => place.id === externalPlaceId) ?? { id: externalPlaceId, name_ko: "외부 ID 일치 장소" };
  const name = normalize(row.name); const address = normalize(row.address);
  return places.find((place) => {
    if (normalize(place.name_ko) !== name) return false;
    if (normalize(place.address_ko) === address) return true;
    const latitude = Number(place.latitude); const longitude = Number(place.longitude);
    return row.latitude !== null && row.longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)
      && coordinateDistanceMeters(row.latitude, row.longitude, latitude, longitude) <= 50;
  }) ?? null;
}
function coordinateDistanceMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) { const radians = (value: number) => value * Math.PI / 180; const lat = radians(latitudeB - latitudeA); const lng = radians(longitudeB - longitudeA); const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(lng / 2) ** 2; return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
function normalize(value: unknown) { return safeText(value, 2000).replace(/\s+/gu, "").toLocaleLowerCase("ko"); }
function numberOrNull(value: string) { if (!value) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function safeText(value: unknown, limit: number) { return typeof value === "string" ? value.normalize("NFKC").trim().slice(0, limit) : ""; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function publicError(message: string, status: number) { return Object.assign(new Error(message), { status, expose: true }); }
function schemaError(error: { code?: string; message?: string }) { return ["42P01", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "") ? publicError("장소 검증·CSV DB 마이그레이션(053)을 먼저 적용해 주세요.", 503) : error; }
async function updateRow(client: AdminClient, id: string, status: string, action: string, importedPlaceId?: string) { await client.from("place_import_rows").update({ status, action, imported_place_id: importedPlaceId ?? null }).eq("id", id); }
function resultRow(row: Record<string, unknown>, result: string, placeId?: string | null, error?: string) { const normalized = row.normalized_data as NormalizedRow; return { row_number: row.row_number, name: normalized.name, result, place_id: placeId ?? "", error: error ?? "" }; }
