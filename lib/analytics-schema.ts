export const analyticsEventNames = [
  "page_view", "place_impression", "place_view", "place_save", "place_unsave",
  "photo_click", "menu_click", "map_click", "directions_click", "phone_click",
  "website_click", "coupon_view", "coupon_claim", "coupon_redeem", "search",
  "filter_apply", "course_save", "home_view", "city_selected", "district_selected", "filter_applied",
  "place_opened", "decision_card_viewed", "warning_viewed", "place_saved", "map_opened",
  "route_saved", "itinerary_created", "itinerary_place_added", "sns_search_started",
  "sns_candidate_confirmed", "ai_route_created", "ai_route_saved", "visit_confirmed",
  "fact_report_submitted", "report_accepted", "report_conflicted", "guide_view", "guide_save",
  "guide_unsave", "guide_place_click", "saved_list_view", "saved_map_view", "marker_click",
  "share", "share_click", "place_search", "place_import_search", "place_import_applied",
  "place_import_modified", "location_requested", "location_succeeded", "location_failed",
  "address_search", "map_location_selected", "coordinate_save_failed", "menu_view",
  "coupon_issued", "coupon_redeemed", "stay_qr_landing", "business_application_submitted",
  "admin_review_completed", "submission_created", "correction_submitted",
] as const;

export type AnalyticsEventName = typeof analyticsEventNames[number];
export type CanonicalAnalyticsEventName =
  | "page_view" | "place_impression" | "place_view" | "place_save" | "place_unsave"
  | "photo_click" | "menu_click" | "map_click" | "directions_click" | "phone_click"
  | "website_click" | "coupon_view" | "coupon_claim" | "coupon_redeem" | "search"
  | "filter_apply" | "course_save";

const eventSet = new Set<string>(analyticsEventNames);
const aliases: Partial<Record<AnalyticsEventName, CanonicalAnalyticsEventName>> = {
  home_view: "page_view", place_opened: "place_view", place_saved: "place_save",
  menu_view: "menu_click", map_opened: "directions_click", coupon_issued: "coupon_claim",
  coupon_redeemed: "coupon_redeem", place_search: "search", filter_applied: "filter_apply",
  route_saved: "course_save", ai_route_saved: "course_save",
};

const forbiddenMetadataKey = /(email|phone|token|secret|password|session|cookie|authorization|query|search_text|request_text|source_url|full_url|latitude|longitude|coordinates|address|notes|ip)/i;
const metadataKeyPattern = /^[a-z][a-z0-9_]{0,47}$/;

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && eventSet.has(value);
}

export function canonicalEventName(value: AnalyticsEventName): CanonicalAnalyticsEventName | AnalyticsEventName {
  return aliases[value] ?? value;
}

export function legacyCompatibleEventName(value: AnalyticsEventName): AnalyticsEventName | null {
  const canonical = canonicalEventName(value);
  const legacy: Partial<Record<string, AnalyticsEventName>> = {
    menu_click: "menu_view", map_click: "map_opened", coupon_claim: "coupon_issued",
    coupon_redeem: "coupon_redeemed", search: "place_search", filter_apply: "filter_applied",
    course_save: "route_saved",
  };
  if (["photo_click", "website_click", "coupon_view"].includes(String(canonical))) return null;
  return legacy[String(canonical)] ?? value;
}

export function sanitizeAnalyticsMetadata(metadata: Record<string, unknown>) {
  const sanitized: Record<string, string | number | boolean | null | Array<string | number | boolean>> = {};
  for (const [key, rawValue] of Object.entries(metadata).slice(0, 32)) {
    if (!metadataKeyPattern.test(key) || forbiddenMetadataKey.test(key)) continue;
    const value = sanitizeValue(rawValue);
    if (value !== undefined) sanitized[key] = value;
  }
  return sanitized;
}

export function safeAnalyticsPath(value: unknown) {
  if (typeof value !== "string") return "";
  const path = value.trim().split(/[?#]/u, 1)[0];
  return path.startsWith("/") && path.length <= 240 ? path : "";
}

export function safeAnalyticsDimension(value: unknown, max = 120) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]*$/iu.test(value) ? value.slice(0, max) : "";
}

export function analyticsDedupeWindowSeconds(eventName: string) {
  if (eventName === "page_view" || eventName === "place_view" || eventName === "place_impression") return 30 * 60;
  if (eventName === "search" || eventName === "filter_apply") return 10;
  if (eventName.endsWith("_click") || eventName === "map_click") return 5;
  return 0;
}

export function analyticsDeviceType(value: unknown, userAgent: string): "mobile" | "tablet" | "desktop" {
  if (value === "mobile" || value === "desktop" || value === "tablet") return value;
  if (/ipad|tablet/iu.test(userAgent)) return "tablet";
  return /mobile|android|iphone/iu.test(userAgent) ? "mobile" : "desktop";
}

function sanitizeValue(value: unknown): string | number | boolean | null | Array<string | number | boolean> | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (!Array.isArray(value)) return undefined;
  const items: Array<string | number | boolean> = [];
  for (const item of value.slice(0, 10)) {
    if (typeof item === "string") items.push(item.slice(0, 80));
    else if (typeof item === "number" && Number.isFinite(item)) items.push(item);
    else if (typeof item === "boolean") items.push(item);
  }
  return items;
}
