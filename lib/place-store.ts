import { demoPlaces } from "@/data/demo-places";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type {
  PlaceListResult,
  PlaceMenuItem,
  PlacePayload,
  PlaceRecord,
  PlaceWithRelations,
  TagRecord,
} from "@/types/database";

type SupabasePlaceRow = PlaceRecord & {
  place_tags?: Array<{
    tags: TagRecord | null;
  }> | null;
  place_menu_items?: PlaceMenuItem[] | null;
};

type PlaceWriteRow = Omit<PlacePayload, "tags" | "menu_items">;

export function formatWon(value: number | null) {
  if (value === null || value === 0) {
    return value === 0 ? "免费" : "价格未登记";
  }

  return `₩${value.toLocaleString("ko-KR")}`;
}

export function formatPriceRange(place: Pick<PlaceRecord, "price_min" | "price_max">) {
  if (place.price_min === 0 && place.price_max === 0) {
    return "免费";
  }

  if (place.price_min !== null && place.price_max !== null && place.price_min !== place.price_max) {
    return `${formatWon(place.price_min)}-${formatWon(place.price_max)}`;
  }

  return formatWon(place.price_min ?? place.price_max);
}

function mapPlace(row: SupabasePlaceRow): PlaceWithRelations {
  const tags =
    row.place_tags
      ?.map((item) => item.tags)
      .filter((tag): tag is TagRecord => Boolean(tag)) ?? [];

  const menuItems = [...(row.place_menu_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return {
    ...row,
    tags,
    menu_items: menuItems,
  };
}

function withDemoFallback(error?: string): PlaceListResult {
  return {
    places: demoPlaces,
    source: "demo",
    error,
  };
}

export async function getPlaces(options: { activeOnly?: boolean; featuredOnly?: boolean } = {}): Promise<PlaceListResult> {
  const client = getSupabaseClient();

  if (!client) {
    return withDemoFallback("Supabase 환경 변수가 없어 demo 데이터를 사용합니다.");
  }

  let query = client
    .from("places")
    .select("*, place_tags(tags(*)), place_menu_items(*)")
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
    return withDemoFallback(error?.message ?? "Supabase 데이터를 불러오지 못했습니다.");
  }

  return {
    places: (data as SupabasePlaceRow[]).map(mapPlace),
    source: "supabase",
  };
}

export async function getPlaceBySlug(
  slug: string,
  options: { activeOnly?: boolean } = {},
): Promise<{ place: PlaceWithRelations | null; source: "supabase" | "demo"; error?: string }> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      place: demoPlaces.find((place) => place.slug === slug) ?? null,
      source: "demo",
      error: "Supabase 환경 변수가 없어 demo 데이터를 사용합니다.",
    };
  }

  let query = client
    .from("places")
    .select("*, place_tags(tags(*)), place_menu_items(*)")
    .eq("slug", slug);

  if (options.activeOnly ?? true) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    const demoPlace = demoPlaces.find((place) => place.slug === slug) ?? null;

    return {
      place: demoPlace,
      source: "demo",
      error: error?.message ?? "장소를 찾지 못했습니다.",
    };
  }

  return {
    place: mapPlace(data as SupabasePlaceRow),
    source: "supabase",
  };
}

function toPlaceWriteRow(payload: PlacePayload): PlaceWriteRow {
  const { tags: _tags, menu_items: _menuItems, ...place } = payload;
  void _tags;
  void _menuItems;

  return place;
}

async function syncTags(placeId: string, tags: PlacePayload["tags"]) {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  await client.from("place_tags").delete().eq("place_id", placeId);

  if (tags.length === 0) {
    return;
  }

  const normalizedTags = tags.map((tag) => ({
    slug: tag.slug,
    label_zh: tag.label_zh,
    label_ko: tag.label_ko,
  }));

  const { data: upsertedTags, error: tagError } = await client
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

  const { error: linkError } = await client.from("place_tags").insert(links);

  if (linkError) {
    throw new Error(linkError.message);
  }
}

async function syncMenuItems(placeId: string, menuItems: PlacePayload["menu_items"]) {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  await client.from("place_menu_items").delete().eq("place_id", placeId);

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

  const { error } = await client.from("place_menu_items").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPlace(payload: PlacePayload): Promise<PlaceWithRelations> {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await client.from("places").insert(toPlaceWriteRow(payload)).select("id").single();

  if (error || !data) {
    throw new Error(error?.message ?? "장소 추가에 실패했습니다.");
  }

  const id = (data as Pick<PlaceRecord, "id">).id;
  await syncTags(id, payload.tags);
  await syncMenuItems(id, payload.menu_items);

  const result = await getPlaceBySlug(payload.slug, { activeOnly: false });

  if (!result.place) {
    throw new Error("저장한 장소를 다시 불러오지 못했습니다.");
  }

  return result.place;
}

export async function updatePlace(id: string, payload: PlacePayload): Promise<PlaceWithRelations> {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.from("places").update(toPlaceWriteRow(payload)).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await syncTags(id, payload.tags);
  await syncMenuItems(id, payload.menu_items);

  const result = await getPlaceBySlug(payload.slug, { activeOnly: false });

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

export async function requireSupabase() {
  if (!isSupabaseConfigured || !getSupabaseClient()) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }
}
