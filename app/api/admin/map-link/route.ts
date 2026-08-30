import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { analyzeMapLink } from "@/lib/map-link-analysis";
import { canGeneratePlaceSummary, generatePlaceSummaryDraft } from "@/lib/openai-place-summary";

export const dynamic = "force-dynamic";

const maxRedirects = 5;
const allowedHosts = [
  "naver.com",
  "naver.me",
  "map.naver.com",
  "kakao.com",
  "kakao.link",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
];

function mapLinkError(message: string, status = 400) {
  return Object.assign(new Error(message), { status, expose: true });
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { url?: string };
    const inputUrl = body.url?.trim();

    if (!inputUrl) {
      return NextResponse.json({ message: "지도 링크를 먼저 입력해 주세요." }, { status: 400 });
    }

    const resolvedUrls = await resolveMapRedirects(inputUrl);
    const analysis = analyzeMapLink(inputUrl, resolvedUrls);
    let summary: Awaited<ReturnType<typeof generatePlaceSummaryDraft>> = null;
    let summaryError = "";

    if (canGeneratePlaceSummary()) {
      try {
        summary = await generatePlaceSummaryDraft(analysis);
      } catch (error) {
        summaryError = error instanceof Error ? error.message : "OpenAI 설명 생성에 실패했습니다.";
      }
    }

    return NextResponse.json({
      analysis,
      summary,
      summaryError,
      aiConfigured: canGeneratePlaceSummary(),
    });
  } catch (error) {
    const response = adminErrorResponse(error);

    return NextResponse.json({ message: response.message }, { status: response.status });
  }
}

async function resolveMapRedirects(inputUrl: string) {
  const urls: string[] = [];
  let currentUrl: URL;

  try {
    currentUrl = new URL(inputUrl);
  } catch {
    throw mapLinkError("올바른 지도 링크를 입력해 주세요.");
  }

  assertAllowedMapHost(currentUrl);

  for (let step = 0; step < maxRedirects; step += 1) {
    const response = await fetch(currentUrl, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
    }).catch(() =>
      fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
      }),
    );

    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) {
      const discoveredUrls = await discoverMapUrls(currentUrl);
      for (const discoveredUrl of discoveredUrls) {
        assertAllowedMapHost(discoveredUrl);
        urls.push(discoveredUrl.toString());
      }
      break;
    }

    currentUrl = new URL(location, currentUrl);
    assertAllowedMapHost(currentUrl);
    urls.push(currentUrl.toString());
  }

  return urls;
}

async function discoverMapUrls(url: URL) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  }).catch(() => null);

  if (!response) {
    return [];
  }

  const location = response.headers.get("location");
  if (location && response.status >= 300 && response.status < 400) {
    return [new URL(location, url)];
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    return [];
  }

  const html = await response.text();
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
        const discoveredUrl = new URL(decodeURIComponent(normalizedValue), url);
        const host = discoveredUrl.hostname.toLowerCase();
        const allowed = allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));

        if (allowed) {
          discovered.set(discoveredUrl.toString(), discoveredUrl);
        }
      } catch {
        // Ignore non-URL snippets found in arbitrary HTML.
      }
    }
  }

  return [...discovered.values()].slice(0, maxRedirects);
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'");
}

function assertAllowedMapHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw mapLinkError("지원하지 않는 지도 링크입니다.");
  }

  const host = url.hostname.toLowerCase();
  const allowed = allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));

  if (!allowed) {
    throw mapLinkError("네이버/카카오/구글 지도 링크만 분석할 수 있습니다.");
  }
}
