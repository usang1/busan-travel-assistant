export const siteConfig = {
  name: "釜山旅行助手",
  englishName: "Busan Travel Assistant",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://busan-travel-assistant.vercel.app",
  description: "面向中国自由行游客的釜山广安里旅行工具，整理美食、拍照机位、行李寄存、韩语沟通和旅行路线。",
  locale: "zh_CN",
  contactEmail: "hello@example.com",
};

export function absoluteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
