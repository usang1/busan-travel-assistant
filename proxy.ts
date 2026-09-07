import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n";

const PUBLIC_FILE = /\.[^/]+$/;
const PASSTHROUGH_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);

function shouldPassThrough(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    PASSTHROUGH_PATHS.has(pathname) ||
    PUBLIC_FILE.test(pathname)
  );
}

function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldPassThrough(pathname)) {
    return nextWithPathname(request);
  }

  const firstSegment = pathname.split("/").filter(Boolean)[0];

  if (!isLocale(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url, 308);
  }

  return nextWithPathname(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
