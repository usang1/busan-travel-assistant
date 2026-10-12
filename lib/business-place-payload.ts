import { validatePlacePayloadForSave, validatePlaceReadyForPublication } from "@/lib/place-validation";
import type { PlacePayload, PlaceWithRelations } from "@/types/database";

const adminOnlyKeys = [
  "id", "status", "is_active", "is_featured", "admin_summary", "verification_tier",
  "verification_checked_at", "verification_checked_by", "verification_note",
  "verification_source_urls", "verified_visit_at", "direct_visit_photos", "last_verified_at",
  "created_at", "updated_at", "decision_profile", "operating_profile",
] as const;
const adminChinaKeys = [
  "verification_status", "verification_basis", "traveler_confirmation_count", "has_information_conflict",
  "verified_at", "manual_summary_override", "manual_warning_override",
] as const;

export function sanitizeBusinessPlacePayload(input: unknown): Partial<PlacePayload> {
  const source = isObject(input) ? structuredClone(input) : {};
  for (const key of adminOnlyKeys) delete source[key];
  if (isObject(source.china_info)) for (const key of adminChinaKeys) delete source.china_info[key];
  if (isObject(source.source)) {
    delete source.source.raw_metadata;
    delete source.source.last_synced_at;
  }
  if (Array.isArray(source.menu_items)) {
    source.menu_items = source.menu_items.slice(0, 100).map((item) => {
      const safe = isObject(item) ? item : {};
      delete safe.id;
      delete safe.place_id;
      return safe;
    });
  }
  return source as Partial<PlacePayload>;
}

export function prepareBusinessPlacePayload(input: unknown, existing?: PlaceWithRelations | null): PlacePayload {
  const safe = sanitizeBusinessPlacePayload(input);
  const existingChina = existing?.china_info ?? null;
  const existingSource = existing?.sources?.find((source) => source.provider === safe.source?.provider && (
    (safe.source?.external_id && source.external_id === safe.source.external_id)
    || (!safe.source?.external_id && source.source_url === safe.source?.source_url)
  ));
  const payload = {
    ...safe,
    status: existing?.status ?? "REVIEW",
    is_active: existing?.is_active ?? false,
    is_featured: existing?.is_featured ?? false,
    admin_summary: existing?.admin_summary ?? "",
    last_verified_at: existing?.last_verified_at ?? null,
    verification_tier: existing?.verification_tier ?? 0,
    verification_checked_at: existing?.verification_checked_at ?? null,
    verification_checked_by: existing?.verification_checked_by ?? null,
    verification_note: existing?.verification_note ?? null,
    verification_source_urls: existing?.verification_source_urls ?? [],
    verified_visit_at: existing?.verified_visit_at ?? null,
    direct_visit_photos: existing?.direct_visit_photos ?? [],
    source: safe.source ? {
      ...safe.source,
      raw_metadata: existingSource?.raw_metadata ?? null,
      last_synced_at: existingSource?.last_synced_at ?? null,
    } : undefined,
    china_info: safe.china_info ? {
      ...safe.china_info,
      verification_status: existingChina?.verification_status ?? "pending",
      verification_basis: existingChina?.verification_basis ?? "unverified",
      traveler_confirmation_count: existingChina?.traveler_confirmation_count ?? 0,
      has_information_conflict: existingChina?.has_information_conflict ?? false,
      verified_at: existingChina?.verified_at ?? null,
      manual_summary_override: existingChina?.manual_summary_override ?? null,
      manual_warning_override: existingChina?.manual_warning_override ?? null,
    } : null,
  } as PlacePayload;
  validatePlacePayloadForSave(payload);
  return payload;
}

export function validateBusinessPlaceSubmission(input: unknown) {
  const payload = prepareBusinessPlacePayload(input);
  validatePlaceReadyForPublication({
    ...payload,
    status: "PUBLISHED",
    is_active: true,
    // The administrator records the real value atomically on final approval.
    // This prospective value validates completeness without giving the owner
    // control over verification metadata.
    last_verified_at: new Date().toISOString(),
  });
}

export function snapshotPlacePayload(place: PlaceWithRelations): PlacePayload {
  const {
    id: _id, created_at: _createdAt, updated_at: _updatedAt, tags: _tags, menu_items: _menus,
    translations: _translations, sources: _sources, china_info: _chinaInfo,
    decision_profile: _decision, operating_profile: _operating, save_count: _saveCount,
    recent_save_count: _recentSaveCount, recommendation_distance: _distance, ...record
  } = place;
  void _id; void _createdAt; void _updatedAt; void _tags; void _menus; void _translations;
  void _sources; void _chinaInfo; void _decision; void _operating; void _saveCount;
  void _recentSaveCount; void _distance;
  return {
    ...record,
    tags: place.tags,
    menu_items: place.menu_items,
    translations: place.translations?.map(({ locale, name, description, travel_tip, address }) => ({ locale, name, description, travel_tip, address })),
    source: place.sources?.[0] ? {
      provider: place.sources[0].provider,
      source_url: place.sources[0].source_url,
      external_id: place.sources[0].external_id,
      raw_metadata: place.sources[0].raw_metadata,
      last_synced_at: place.sources[0].last_synced_at,
    } : undefined,
    china_info: place.china_info ? { ...place.china_info } : null,
    status: place.status ?? "DRAFT",
    closed_days: place.closed_days ?? "",
  };
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
