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
    source: params.get("utm_source") || current?.source || undefined,
    medium: params.get("utm_medium") || current?.medium || undefined,
    campaign: params.get("utm_campaign") || current?.campaign || undefined,
    content: params.get("utm_content") || current?.content || undefined,
    term: params.get("utm_term") || current?.term || undefined,
    referrer: current?.referrer || sanitizeReferrer(document.referrer),
    landing_path: current?.landing_path || `${window.location.pathname}${window.location.search}`,
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
    return isAttribution(parsed) ? parsed : null;
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
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function hasMeaningfulAttribution(value: SessionAttribution) {
  return Boolean(value.source || value.referrer);
}

function isAttribution(value: unknown): value is SessionAttribution {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;

  return Object.values(item).every((field) => field === undefined || typeof field === "string");
}
