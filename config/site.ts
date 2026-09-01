export const siteConfig = {
  name: "韩国旅行助手",
  englishName: "Korea Travel Assistant",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://busan-travel-assistant.vercel.app",
  description: "面向中国自由行游客的韩国旅行工具，整理釜山、首尔、济州的美食、拍照机位、行李寄存、韩语沟通和旅行路线。",
  locale: "zh_CN",
  contactEmail: "hello@example.com",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
