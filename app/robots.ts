import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/zh/admin", "/ko/admin", "/en/admin", "/ja/admin"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
