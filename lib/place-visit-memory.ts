const mapOpenStorageKey = "bta:map-open-places:v1";
const visitedStorageKey = "bta:visited-places:v1";
const recentWindowMs = 7 * 24 * 60 * 60 * 1000;

export function rememberMapOpen(placeId: string) {
  writeTimestamp(mapOpenStorageKey, placeId);
}

export function rememberTravelerVisit(placeId: string) {
  writeTimestamp(visitedStorageKey, placeId);
}

export function wasMapOpenedRecently(placeId: string, now = Date.now()) {
  return readTimestamp(mapOpenStorageKey, placeId, now);
}

export function wasTravelerVisitSubmitted(placeId: string, now = Date.now()) {
  return readTimestamp(visitedStorageKey, placeId, now);
}

function writeTimestamp(key: string, placeId: string) {
  if (typeof window === "undefined") return;
  const values = readValues(key);
  values[placeId] = Date.now();
  window.localStorage.setItem(key, JSON.stringify(values));
}

function readTimestamp(key: string, placeId: string, now: number) {
  if (typeof window === "undefined") return false;
  const timestamp = readValues(key)[placeId];
  return typeof timestamp === "number" && timestamp <= now && now - timestamp <= recentWindowMs;
}

function readValues(key: string): Record<string, number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}
