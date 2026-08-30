import { analyzeMapLink } from "@/lib/map-link-analysis";
import { isResolvableMapHost, normalizeMapUrl, parseMapUrl } from "@/lib/map-url";

const maxRedirects = 5;

export type ResolvedMapUrl = Awaited<ReturnType<typeof resolveMapUrl>>;

type Fetcher = typeof fetch;

export async function resolveMapUrl(inputUrl: string, fetcher: Fetcher = fetch) {
  const originalUrl = normalizeMapUrl(inputUrl);
  const initialUrl = parseResolvableUrl(originalUrl);
  const resolvedUrls = await resolveMapRedirects(initialUrl, fetcher);
  const analysis = analyzeMapLink(originalUrl, resolvedUrls);

  debugMapResolution({
    provider: analysis.provider,
    originalUrl,
    resolvedUrl: analysis.resolvedUrl,
    placeId: analysis.placeId,
    coordinateSource: analysis.coordinateSource,
    latitude: analysis.latitude,
    longitude: analysis.longitude,
    confidence: analysis.confidence,
    failureReason: analysis.failureReason,
  });

  return {
    provider: analysis.provider,
    sourceProvider: analysis.sourceProvider,
    originalUrl,
    normalizedUrl: analysis.normalizedUrl,
    resolvedUrl: analysis.resolvedUrl ?? originalUrl,
    redirectUrls: resolvedUrls,
    placeId: analysis.placeId,
    externalId: analysis.externalId,
    title: analysis.title,
    latitude: analysis.latitude,
    longitude: analysis.longitude,
    coordinateSource: analysis.coordinateSource,
    confidence: analysis.confidence,
    failureReason: analysis.failureReason,
    analysis,
  };
}

async function resolveMapRedirects(initialUrl: URL, fetcher: Fetcher) {
  const urls: string[] = [];
  let currentUrl = initialUrl;

  for (let step = 0; step < maxRedirects; step += 1) {
    const response = await fetchRedirect(currentUrl, fetcher);
    const location = response?.headers.get("location");

    if (location && response && response.status >= 300 && response.status < 400) {
      currentUrl = parseResolvableUrl(new URL(location, currentUrl).toString());
      urls.push(currentUrl.toString());
      continue;
    }

    const discoveredUrls = response ? await discoverMapUrls(currentUrl, response, fetcher) : [];
    for (const discoveredUrl of discoveredUrls) {
      urls.push(discoveredUrl.toString());
    }
    break;
  }

  return urls;
}

async function fetchRedirect(url: URL, fetcher: Fetcher) {
  const head = await fetcher(url, {
    method: "HEAD",
    redirect: "manual",
    cache: "no-store",
  }).catch(() => null);

  if (head && head.status !== 405) {
    return head;
  }

  return fetcher(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);
}

async function discoverMapUrls(url: URL, response: Response, fetcher: Fetcher) {
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    return location ? [parseResolvableUrl(new URL(location, url).toString())] : [];
  }

  const contentType = response.headers.get("content-type") ?? "";
  let html = "";

  if (contentType.includes("text/html")) {
    html = await response.text();
  } else if (response.bodyUsed) {
    return [];
  } else {
    const getResponse = await fetcher(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    }).catch(() => null);

    if (!getResponse || !(getResponse.headers.get("content-type") ?? "").includes("text/html")) {
      return [];
    }

    html = await getResponse.text();
  }

  const discovered = new Map<string, URL>();
  const decodedHtml = decodeHtmlEntities(html);
  const patterns = [
    /https?:\\?\/\\?\/[^"'<>\\\s]+/g,
    /url=([^"'<>\\\s]+)/gi,
    /content=["'][^"']*url=([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of decodedHtml.matchAll(pattern)) {
      const rawValue = match[1] ?? match[0];
      const normalizedValue = rawValue.replaceAll("\\/", "/").trim();

      try {
        const discoveredUrl = parseResolvableUrl(new URL(decodeURIComponent(normalizedValue), url).toString());
        const parsed = parseMapUrl(discoveredUrl.toString());

        if (parsed.provider !== "unknown") {
          discovered.set(discoveredUrl.toString(), discoveredUrl);
        }
      } catch {
        // Ignore non-URL snippets found in arbitrary HTML.
      }
    }
  }

  return [...discovered.values()].slice(0, maxRedirects);
}

function parseResolvableUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw mapResolveError("올바른 지도 링크를 입력해 주세요.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw mapResolveError("지원하지 않는 지도 링크입니다.");
  }

  if (!isResolvableMapHost(url.hostname)) {
    throw mapResolveError("네이버/카카오/구글 지도 링크만 분석할 수 있습니다.");
  }

  return url;
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'");
}

function mapResolveError(message: string, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

function debugMapResolution(details: {
  provider: string;
  originalUrl: string;
  resolvedUrl?: string;
  placeId?: string;
  coordinateSource: string;
  latitude?: number;
  longitude?: number;
  confidence: string;
  failureReason?: string;
}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  // eslint-disable-next-line no-console
  console.info("[maps:resolve]", details);
}
