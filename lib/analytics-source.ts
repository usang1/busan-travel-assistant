"use client";

export type SessionAttribution = {
  visit_id?: string;
  channel?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landing_path?: string;
  campaign_id?: string;
  stay_id?: string;
};

const attributionStorageKey = "busan-travel-assistant-session-attribution";
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
let memoryAttribution: SessionAttribution | null = null;

export function captureSessionAttribution() {
  if (typeof window === "undefined") return;

  const current = readSessionAttribution();
  const params = new URLSearchParams(window.location.search);
  const hasUtm = utmKeys.some((key) => Boolean(params.get(key)));
  const hasInternalCampaign = Boolean(params.get("sp_campaign") || params.get("sp_stay"));

  if (current?.visit_id && !hasUtm && !hasInternalCampaign) return;

  const source = shortValue(params.get("utm_source")) || current?.source || "direct";
  const medium = shortValue(params.get("utm_medium")) || current?.medium || undefined;
  const stayId = safeIdentifier(params.get("sp_stay")) || current?.stay_id;
  const attribution: SessionAttribution = {
    visit_id: current?.visit_id || createVisitId(),
    channel: classifyChannel(source, medium, stayId, document.referrer),
    source,
    medium,
    campaign: shortValue(params.get("utm_campaign")) || current?.campaign || undefined,
    content: shortValue(params.get("utm_content")) || current?.content || undefined,
    term: shortValue(params.get("utm_term")) || current?.term || undefined,
    referrer: current?.referrer || sanitizeReferrer(document.referrer),
    // Query strings can contain free text, OAuth codes, or other identifiers.
    landing_path: sanitizePath(current?.landing_path || window.location.pathname),
    campaign_id: safeIdentifier(params.get("sp_campaign")) || current?.campaign_id,
    stay_id: stayId,
  };
  memoryAttribution = attribution;

  try {
    window.sessionStorage.setItem(attributionStorageKey, JSON.stringify(attribution));
  } catch {
    // Storage can be blocked in private or hardened browser contexts. Analytics
    // may be incomplete, but the product flow must remain available.
  }
}

export function readSessionAttribution(): SessionAttribution | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(attributionStorageKey);
    if (!raw) return memoryAttribution;
    const parsed = JSON.parse(raw);
    if (!isAttribution(parsed)) return memoryAttribution;
    memoryAttribution = { ...parsed, landing_path: sanitizePath(parsed.landing_path) };
    return memoryAttribution;
  } catch {
    return memoryAttribution;
  }
}

export function getAnalyticsMetadata(metadata: Record<string, unknown> = {}) {
  const attribution = readSessionAttribution();
  if (!attribution) return metadata;

  return {
    ...metadata,
    initial_source: attribution.source,
    channel: attribution.channel,
    initial_medium: attribution.medium,
    initial_campaign: attribution.campaign,
    initial_content: attribution.content,
    initial_term: attribution.term,
    initial_referrer: attribution.referrer,
    landing_path: attribution.landing_path,
    visit_id: attribution.visit_id,
    campaign_id: attribution.campaign_id,
    stay_id: attribution.stay_id,
  };
}

function sanitizeReferrer(value: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.hostname.slice(0, 120);
  } catch {
    return undefined;
  }
}

function sanitizePath(value: string | undefined) {
  if (!value) return undefined;
  return value.split(/[?#]/, 1)[0].slice(0, 240) || undefined;
}

function shortValue(value: string | null) {
  return value?.trim().slice(0, 120) || undefined;
}

function isAttribution(value: unknown): value is SessionAttribution {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return Object.values(item).every((field) => field === undefined || (typeof field === "string" && field.length <= 240));
}

function safeIdentifier(value: string | null) {
  const normalized = value?.trim();
  return normalized && /^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(normalized) ? normalized : undefined;
}

function createVisitId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `visit-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function classifyChannel(source: string | undefined, medium: string | undefined, stayId: string | undefined, referrer: string) {
  const value = `${source || ""} ${medium || ""} ${referrer || ""}`.toLowerCase();
  if (stayId || /stay[_ -]?qr|hotel[_ -]?qr|accommodation[_ -]?qr/u.test(value)) return "stay_qr";
  if (/store[_ -]?qr|place[_ -]?qr/u.test(value)) return "place_qr";
  if (/xiaohongshu|小红书|rednote|\bxhs\b/u.test(value)) return "xiaohongshu";
  if (/instagram|instagr\.am/u.test(value)) return "instagram";
  if (/blog\.naver|naver[_ -]?blog/u.test(value)) return "naver_blog";
  if (/google/u.test(value)) return "google_search";
  if (!source || source === "direct") return "direct";
  return "other";
}
