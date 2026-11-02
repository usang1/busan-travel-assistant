const PRODUCTION_SITE_URL = "https://spotzari.com";
const LOCAL_SITE_URL = "http://localhost:3000";

export function resolvePublicSiteUrl(
  configuredUrl = process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv = process.env.NODE_ENV,
) {
  const value = configuredUrl?.trim();
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      // Fall through to a safe environment-specific URL.
    }
  }

  return nodeEnv === "development" || nodeEnv === "test" ? LOCAL_SITE_URL : PRODUCTION_SITE_URL;
}

export const siteConfig = {
  name: "spotzari",
  englishName: "spotzari",
  // Production metadata must never silently fall back to a Vercel deployment
  // hostname. Preview/staging builds can opt into their own origin explicitly.
  url: resolvePublicSiteUrl(),
  description: "面向首尔、釜山、济州自由行游客，帮助判断现在值不值得去、该点什么、外国人是否方便，以及要避开什么。",
  locale: "zh_CN",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
