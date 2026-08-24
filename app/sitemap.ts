import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";

const routes = [
  "/",
  "/places",
  "/photo-spots",
  "/nearby",
  "/itinerary",
  "/translator",
  "/luggage",
  "/pricing",
  "/saved",
  "/service-info",
  "/privacy",
  "/terms",
  "/contact",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: absoluteUrl(route),
    lastModified: new Date(),
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
