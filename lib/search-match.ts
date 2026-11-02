import type { PlaceMenuItem } from "@/types/database";

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export function matchesSearchQuery(query: string, fields: Array<string | null | undefined>) {
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const document = normalizeSearchText(fields.filter(Boolean).join(" "));
  return tokens.every((token) => document.includes(token));
}

export function getMenuSearchFields(item: PlaceMenuItem) {
  return [
    item.name_ko,
    item.name_zh,
    item.description_zh,
    item.korean_original_name,
    ...Object.values(item.localized_name ?? {}),
  ];
}
