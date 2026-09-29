import { emptyTravelerTrustSummary, type TravelerTrustSummary } from "@/lib/traveler-verification";

type Resolver = (summary: TravelerTrustSummary) => void;

const cache = new Map<string, { summary: TravelerTrustSummary; expiresAt: number }>();
const pending = new Map<string, Resolver[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function loadTravelerTrustSummary(placeId: string) {
  const cached = cache.get(placeId);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.summary);

  return new Promise<TravelerTrustSummary>((resolve) => {
    pending.set(placeId, [...(pending.get(placeId) ?? []), resolve]);
    if (!flushTimer) flushTimer = setTimeout(() => void flush(), 10);
  });
}

export function invalidateTravelerTrustSummary(placeId: string) {
  cache.delete(placeId);
}

async function flush() {
  flushTimer = null;
  const batch = [...pending.entries()].slice(0, 50);
  if (!batch.length) return;
  for (const [placeId] of batch) pending.delete(placeId);

  const ids = batch.map(([placeId]) => placeId);
  let summaries: Record<string, TravelerTrustSummary> = {};
  try {
    const response = await fetch(`/api/traveler-verifications?placeIds=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
    if (response.ok) {
      const body = await response.json() as { summaries?: Record<string, TravelerTrustSummary> };
      summaries = body.summaries ?? {};
    }
  } catch {
    // Trust signals are supplementary and must not block place discovery.
  }

  for (const [placeId, resolvers] of batch) {
    const summary = summaries[placeId] ?? emptyTravelerTrustSummary();
    cache.set(placeId, { summary, expiresAt: Date.now() + 30_000 });
    for (const resolve of resolvers) resolve(summary);
  }
  if (pending.size && !flushTimer) flushTimer = setTimeout(() => void flush(), 10);
}
