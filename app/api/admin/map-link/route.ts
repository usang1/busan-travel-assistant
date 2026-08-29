import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { analyzeMapLink } from "@/lib/map-link-analysis";

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

    return NextResponse.json({ analysis });
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
      break;
    }

    currentUrl = new URL(location, currentUrl);
    assertAllowedMapHost(currentUrl);
    urls.push(currentUrl.toString());
  }

  return urls;
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
