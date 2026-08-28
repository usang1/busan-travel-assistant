import type { SupabaseClient } from "@supabase/supabase-js";
import { demoPlaces } from "@/data/demo-places";
import { getPlaceSaveCounts, withPlaceSaveCounts } from "@/lib/place-saves";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  PlaceChinaInfoRecord,
  PlaceTranslationRecord,
  PlaceListResult,
  PlaceMenuItem,
  PlacePayload,
  PlaceRecord,
  PlaceWithRelations,
  TagRecord,
} from "@/types/database";
import type { Locale } from "@/lib/i18n";

type SupabasePlaceRow = PlaceRecord & {
  place_china_info?: PlaceChinaInfoRecord | PlaceChinaInfoRecord[] | null;
  place_translations?: PlaceTranslationRecord[] | null;
  place_tags?: Array<{
    tags: TagRecord | null;
  }> | null;
  place_menu_items?: PlaceMenuItem[] | null;
};

type PlaceWriteRow = Omit<PlacePayload, "tags" | "menu_items" | "china_info">;
const placeSelectWithChinaInfo = "*, place_china_info(*), place_translations(*), place_tags(tags(*)), place_menu_items(*)";
const placeSelectWithTranslations = "*, place_translations(*), place_tags(tags(*)), place_menu_items(*)";
const legacyPlaceSelect = "*, place_tags(tags(*)), place_menu_items(*)";

const priceLabels: Record<Locale, { free: string; unknown: string }> = {
  zh: { free: "免费", unknown: "价格未登记" },
  en: { free: "Free", unknown: "Price not listed" },
  ja: { free: "無料", unknown: "価格未登録" },
  ko: { free: "무료", unknown: "가격 미등록" },
};

function normalizePlaceTranslations(row: SupabasePlaceRow): PlaceTranslationRecord[] {
  const explicitTranslations = row.place_translations ?? [];
  const locales = new Set(explicitTranslations.map((translation) => translation.locale));
  const fallbackTranslations: PlaceTranslationRecord[] = [];

  if (!locales.has("zh")) {
    fallbackTranslations.push({
      id: `${row.id}-legacy-zh`,
      place_id: row.id,
      locale: "zh",
      name: row.name_zh,
      description: row.short_description_zh,
      travel_tip: row.tips_zh,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  if (!locales.has("ko")) {
    fallbackTranslations.push({
      id: `${row.id}-legacy-ko`,
      place_id: row.id,
      locale: "ko",
      name: row.name_ko,
      description: row.short_description_ko,
      travel_tip: row.tips_ko,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  return [...explicitTranslations, ...fallbackTranslations];
}

export function formatWon(value: number | null, locale: Locale = "zh") {
  if (value === null || value === 0) {
    return value === 0 ? priceLabels[locale].free : priceLabels[locale].unknown;
  }

  return `₩${value.toLocaleString("ko-KR")}`;
}

export function formatPriceRange(place: Pick<PlaceRecord, "price_min" | "price_max">, locale: Locale = "zh") {
  if (place.price_min === 0 && place.price_max === 0) {
    return priceLabels[locale].free;
  }

  if (place.price_min !== null && place.price_max !== null && place.price_min !== place.price_max) {
    return `${formatWon(place.price_min, locale)}-${formatWon(place.price_max, locale)}`;
  }

  return formatWon(place.price_min ?? place.price_max, locale);
}

function mapPlace(row: SupabasePlaceRow): PlaceWithRelations {
  const tags =
    row.place_tags
      ?.map((item) => item.tags)
      .filter((tag): tag is TagRecord => Boolean(tag)) ?? [];

  const menuItems = [...(row.place_menu_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const chinaInfo = Array.isArray(row.place_china_info)
    ? (row.place_china_info[0] ?? null)
    : (row.place_china_info ?? null);

  return {
    ...row,
    china_info: chinaInfo,
    tags,
    menu_items: menuItems,
    translations: normalizePlaceTranslations(row),
  };
}

function withDemoFallback(error?: string): PlaceListResult {
  return {
    places: demoPlaces.map((place) => ({ ...place, save_count: 0 })),
    source: "demo",
    error,
  };
}

async function addSaveCounts(places: PlaceWithRelations[]) {
  const counts = await getPlaceSaveCounts(places.map((place) => place.id));

  return withPlaceSaveCounts(places, counts);
}

export async function getPlaces(
  options: { activeOnly?: boolean; featuredOnly?: boolean } = {},
  client?: SupabaseClient,
): Promise<PlaceListResult> {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    return withDemoFallback("Supabase 환경 변수가 없어 demo 데이터를 사용합니다.");
  }

  let query = resolvedClient
    .from("places")
    .select(placeSelectWithChinaInfo)
    .order("is_featured", { ascending: false })
    .order("updated_at", { ascending: false });

  if (options.activeOnly ?? true) {
    query = query.eq("is_active", true);
  }

  if (options.featuredOnly) {
    query = query.eq("is_featured", true);
  }

  const { data, error } = await query;

  if (error || !data) {
    let compatibleQuery = resolvedClient
      .from("places")
      .select(placeSelectWithTranslations)
      .order("is_featured", { ascending: false })
      .order("updated_at", { ascending: false });

    if (options.activeOnly ?? true) {
      compatibleQuery = compatibleQuery.eq("is_active", true);
    }

    if (options.featuredOnly) {
      compatibleQuery = compatibleQuery.eq("is_featured", true);
    }

    const compatibleResult = await compatibleQuery;

    if (!compatibleResult.error && compatibleResult.data) {
      return {
        places: await addSaveCounts((compatibleResult.data as SupabasePlaceRow[]).map(mapPlace)),
        source: "supabase",
      };
    }

    let legacyQuery = resolvedClient
      .from("places")
      .select(legacyPlaceSelect)
      .order("is_featured", { ascending: false })
      .order("updated_at", { ascending: false });

    if (options.activeOnly ?? true) {
      legacyQuery = legacyQuery.eq("is_active", true);
    }

    if (options.featuredOnly) {
      legacyQuery = legacyQuery.eq("is_featured", true);
    }

    const legacyResult = await legacyQuery;

    if (legacyResult.error || !legacyResult.data) {
      return withDemoFallback(legacyResult.error?.message ?? compatibleResult.error?.message ?? error?.message ?? "Supabase 데이터를 불러오지 못했습니다.");
    }

    return {
      places: await addSaveCounts((legacyResult.data as SupabasePlaceRow[]).map(mapPlace)),
      source: "supabase",
    };
  }

  return {
    places: await addSaveCounts((data as SupabasePlaceRow[]).map(mapPlace)),
    source: "supabase",
  };
}

export async function getPlaceBySlug(
  slug: string,
  options: { activeOnly?: boolean } = {},
  client?: SupabaseClient,
): Promise<{ place: PlaceWithRelations | null; source: "supabase" | "demo"; error?: string }> {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    return {
      place: demoPlaces.find((place) => place.slug === slug) ?? null,
      source: "demo",
      error: "Supabase 환경 변수가 없어 demo 데이터를 사용합니다.",
    };
  }

  let query = resolvedClient
    .from("places")
    .select(placeSelectWithChinaInfo)
    .eq("slug", slug);

  if (options.activeOnly ?? true) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    let compatibleQuery = resolvedClient
      .from("places")
      .select(placeSelectWithTranslations)
      .eq("slug", slug);

    if (options.activeOnly ?? true) {
      compatibleQuery = compatibleQuery.eq("is_active", true);
    }

    const compatibleResult = await compatibleQuery.single();

    if (!compatibleResult.error && compatibleResult.data) {
      const place = mapPlace(compatibleResult.data as SupabasePlaceRow);
      const counts = await getPlaceSaveCounts([place.id]);

      return {
        place: { ...place, save_count: counts.get(place.id) ?? 0 },
        source: "supabase",
      };
    }

    let legacyQuery = resolvedClient
      .from("places")
      .select(legacyPlaceSelect)
      .eq("slug", slug);

    if (options.activeOnly ?? true) {
      legacyQuery = legacyQuery.eq("is_active", true);
    }

    const legacyResult = await legacyQuery.single();

    if (!legacyResult.error && legacyResult.data) {
      const place = mapPlace(legacyResult.data as SupabasePlaceRow);
      const counts = await getPlaceSaveCounts([place.id]);

      return {
        place: { ...place, save_count: counts.get(place.id) ?? 0 },
        source: "supabase",
      };
    }

    const demoPlace = demoPlaces.find((place) => place.slug === slug) ?? null;

    return {
      place: demoPlace ? { ...demoPlace, save_count: 0 } : null,
      source: "demo",
      error: legacyResult.error?.message ?? compatibleResult.error?.message ?? error?.message ?? "장소를 찾지 못했습니다.",
    };
  }

  const place = mapPlace(data as SupabasePlaceRow);
  const counts = await getPlaceSaveCounts([place.id]);

  return {
    place: { ...place, save_count: counts.get(place.id) ?? 0 },
    source: "supabase",
  };
}

function toPlaceWriteRow(payload: PlacePayload): PlaceWriteRow {
  const { tags: _tags, menu_items: _menuItems, translations: _translations, source: _source, china_info: _chinaInfo, ...place } = payload;
  void _tags;
  void _menuItems;
  void _translations;
  void _source;
  void _chinaInfo;

  return place;
}

function resolveClient(client?: SupabaseClient) {
  return client ?? getSupabaseClient();
}

async function syncTags(placeId: string, tags: PlacePayload["tags"], client?: SupabaseClient) {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    throw new Error("Supabase is not configured.");
  }

  await resolvedClient.from("place_tags").delete().eq("place_id", placeId);

  if (tags.length === 0) {
    return;
  }

  const normalizedTags = tags.map((tag) => ({
    slug: tag.slug,
    label_zh: tag.label_zh,
    label_ko: tag.label_ko,
  }));

  const { data: upsertedTags, error: tagError } = await resolvedClient
    .from("tags")
    .upsert(normalizedTags, { onConflict: "slug" })
    .select("id, slug, label_zh, label_ko");

  if (tagError || !upsertedTags) {
    throw new Error(tagError?.message ?? "태그 저장에 실패했습니다.");
  }

  const links = (upsertedTags as TagRecord[]).map((tag) => ({
    place_id: placeId,
    tag_id: tag.id,
  }));

  const { error: linkError } = await resolvedClient.from("place_tags").insert(links);

  if (linkError) {
    throw new Error(linkError.message);
  }
}

async function syncMenuItems(placeId: string, menuItems: PlacePayload["menu_items"], client?: SupabaseClient) {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    throw new Error("Supabase is not configured.");
  }

  await resolvedClient.from("place_menu_items").delete().eq("place_id", placeId);

  if (menuItems.length === 0) {
    return;
  }

  const rows = menuItems.map((item, index) => ({
    place_id: placeId,
    name_ko: item.name_ko,
    name_zh: item.name_zh,
    description_zh: item.description_zh,
    price: item.price,
    is_recommended: item.is_recommended,
    sort_order: item.sort_order || index + 1,
  }));

  const { error } = await resolvedClient.from("place_menu_items").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

async function syncTranslations(placeId: string, payload: PlacePayload, client?: SupabaseClient) {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    throw new Error("Supabase is not configured.");
  }

  const translations = payload.translations?.length
    ? payload.translations
    : [
        {
          locale: "zh" as const,
          name: payload.name_zh,
          description: payload.short_description_zh,
          travel_tip: payload.tips_zh,
        },
        {
          locale: "ko" as const,
          name: payload.name_ko,
          description: payload.short_description_ko,
          travel_tip: payload.tips_ko,
        },
      ];

  if (translations.length === 0) {
    return;
  }

  const rows = translations
    .filter((translation) => translation.name.trim())
    .map((translation) => ({
      place_id: placeId,
      locale: translation.locale,
      name: translation.name,
      description: translation.description,
      travel_tip: translation.travel_tip,
    }));

  const { error } = await resolvedClient
    .from("place_translations")
    .upsert(rows, { onConflict: "place_id,locale" });

  if (error) {
    throw new Error(error.message);
  }
}

async function syncSource(placeId: string, payload: PlacePayload, client?: SupabaseClient) {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient || !payload.source?.source_url) {
    return;
  }

  const sourceRow = {
    place_id: placeId,
    provider: payload.source.provider,
    external_id: payload.source.external_id || null,
    source_url: payload.source.source_url,
  };
  const { data: existing } = await resolvedClient
    .from("place_sources")
    .select("id")
    .eq("place_id", placeId)
    .eq("provider", payload.source.provider)
    .eq("source_url", payload.source.source_url)
    .maybeSingle();
  const { error } = existing
    ? await resolvedClient.from("place_sources").update(sourceRow).eq("id", existing.id)
    : await resolvedClient.from("place_sources").insert(sourceRow);

  if (error) {
    throw new Error(error.message);
  }
}

async function syncChinaInfo(placeId: string, payload: PlacePayload, client?: SupabaseClient) {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient || !payload.china_info) {
    return;
  }

  const { error } = await resolvedClient
    .from("place_china_info")
    .upsert({ place_id: placeId, ...payload.china_info }, { onConflict: "place_id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPlace(payload: PlacePayload, client?: SupabaseClient): Promise<PlaceWithRelations> {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await resolvedClient.from("places").insert(toPlaceWriteRow(payload)).select("id").single();

  if (error || !data) {
    throw new Error(error?.message ?? "장소 추가에 실패했습니다.");
  }

  const id = (data as Pick<PlaceRecord, "id">).id;
  await syncTags(id, payload.tags, resolvedClient);
  await syncMenuItems(id, payload.menu_items, resolvedClient);
  await syncTranslations(id, payload, resolvedClient);
  await syncSource(id, payload, resolvedClient);
  await syncChinaInfo(id, payload, resolvedClient);

  const result = await getPlaceBySlug(payload.slug, { activeOnly: false }, resolvedClient);

  if (!result.place) {
    throw new Error("저장한 장소를 다시 불러오지 못했습니다.");
  }

  return result.place;
}

export async function updatePlace(id: string, payload: PlacePayload, client?: SupabaseClient): Promise<PlaceWithRelations> {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await resolvedClient.from("places").update(toPlaceWriteRow(payload)).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await syncTags(id, payload.tags, resolvedClient);
  await syncMenuItems(id, payload.menu_items, resolvedClient);
  await syncTranslations(id, payload, resolvedClient);
  await syncSource(id, payload, resolvedClient);
  await syncChinaInfo(id, payload, resolvedClient);

  const result = await getPlaceBySlug(payload.slug, { activeOnly: false }, resolvedClient);

  if (!result.place) {
    throw new Error("수정한 장소를 다시 불러오지 못했습니다.");
  }

  return result.place;
}

export async function deletePlace(id: string) {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.from("places").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function archivePlace(id: string, client?: SupabaseClient) {
  const resolvedClient = resolveClient(client);

  if (!resolvedClient) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await resolvedClient
    .from("places")
    .update({ is_active: false, status: "ARCHIVED" })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function requireSupabase() {
  if (!isSupabaseConfigured || !getSupabaseClient()) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }
}
