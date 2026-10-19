const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

export type ProviderFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export function createProviderFetcher(fetcher: typeof fetch = fetch, options: ProviderFetchOptions = {}): typeof fetch {
  const timeoutMs = options.timeoutMs ?? 8_000;
  const retries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 200;

  return async (input, init) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      init?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await fetcher(input, { ...init, signal: controller.signal });
        if (attempt < retries && retryableStatuses.has(response.status)) {
          await response.body?.cancel().catch(() => undefined);
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= retries || init?.signal?.aborted) {
          if (controller.signal.aborted && !init?.signal?.aborted) {
            throw Object.assign(new Error(`외부 장소 API가 ${timeoutMs / 1000}초 안에 응답하지 않았습니다.`), { code: "PROVIDER_TIMEOUT", status: 504, expose: true });
          }
          throw error;
        }
        await wait(retryDelayMs * (attempt + 1));
      } finally {
        clearTimeout(timeout);
        init?.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastError;
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
