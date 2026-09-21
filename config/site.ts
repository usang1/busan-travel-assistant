export const siteConfig = {
  name: "韩国旅行助手",
  englishName: "Korea Travel Assistant",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://busan-travel-assistant.vercel.app",
  description: "面向第一次来釜山的自由行游客，帮助判断现在值不值得去、该点什么、外国人是否方便，以及要避开什么。",
  locale: "zh_CN",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
