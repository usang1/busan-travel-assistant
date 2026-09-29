"use client";

export type SessionAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landing_path?: string;
};

const attributionStorageKey = "busan-travel-assistant-session-attribution";
const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function captureSessionAttribution() {
  if (typeof window === "undefined") return;

  const current = readSessionAttribution();
  const params = new URLSearchParams(window.location.search);
  const hasUtm = utmKeys.some((key) => Boolean(params.get(key)));

  if (current && !hasUtm) return;

  const attribution: SessionAttribution = {
    source: shortValue(params.get("utm_source")) || current?.source || undefined,
    medium: shortValue(params.get("utm_medium")) || current?.medium || undefined,
    campaign: shortValue(params.get("utm_campaign")) || current?.campaign || undefined,
    content: shortValue(params.get("utm_content")) || current?.content || undefined,
    term: shortValue(params.get("utm_term")) || current?.term || undefined,
    referrer: current?.referrer || sanitizeReferrer(document.referrer),
    // Query strings can contain free text, OAuth codes, or other identifiers.
    landing_path: sanitizePath(current?.landing_path || window.location.pathname),
  };

  if (!hasMeaningfulAttribution(attribution)) return;
  window.sessionStorage.setItem(attributionStorageKey, JSON.stringify(attribution));
}

export function readSessionAttribution(): SessionAttribution | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(attributionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isAttribution(parsed)) return null;
    return { ...parsed, landing_path: sanitizePath(parsed.landing_path) };
  } catch {
    return null;
  }
}

export function getAnalyticsMetadata(metadata: Record<string, unknown> = {}) {
  const attribution = readSessionAttribution();
  if (!attribution) return metadata;

  return {
    ...metadata,
    initial_source: attribution.source,
    initial_medium: attribution.medium,
    initial_campaign: attribution.campaign,
    initial_content: attribution.content,
    initial_term: attribution.term,
    initial_referrer: attribution.referrer,
    landing_path: attribution.landing_path,
  };
}

function sanitizeReferrer(value: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 240);
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

function hasMeaningfulAttribution(value: SessionAttribution) {
  return Boolean(value.source || value.referrer);
}

function isAttribution(value: unknown): value is SessionAttribution {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return Object.values(item).every((field) => field === undefined || (typeof field === "string" && field.length <= 240));
}
