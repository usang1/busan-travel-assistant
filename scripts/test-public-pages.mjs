import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(process.env.BROWSER_TEST_MODULE ? pathToFileURL(process.env.BROWSER_TEST_MODULE).href : "playwright");
const base = process.env.PUBLIC_BROWSER_BASE_URL || "http://localhost:3100";
const output = process.env.PUBLIC_BROWSER_OUTPUT || "/tmp/busan-public-audit";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const failures = [];
const results = [];
try {
  for (const locale of ["ko", "zh", "en", "ja"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const route of ["", "/places", "/nearby", "/guides", "/photo-spots", "/luggage", "/contact", "/service-info", "/privacy", "/terms", "/translator", "/saved", "/itinerary", "/login", "/mypage", "/pricing", "/submissions"]) {
      const url = `/${locale}${route}`;
      const response = await page.goto(base + url, { waitUntil: "networkidle", timeout: 90000 });
      const info = await page.evaluate(() => ({
        headings: [...document.querySelectorAll("h1")].map((node) => node.textContent),
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        lang: document.documentElement.lang,
        robots: document.querySelector('meta[name="robots"]')?.content,
        schemas: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent)),
      }));
      if (response.status() !== 200) failures.push(`${url}: HTTP ${response.status()}`);
      if (info.headings.length !== 1) failures.push(`${url}: ${info.headings.length} H1s`);
      if (!info.title || !info.description || new URL(info.canonical || base).pathname !== url) failures.push(`${url}: missing/incorrect metadata`);
      if (["/saved", "/login", "/mypage", "/itinerary"].includes(route) && !info.robots?.includes("noindex")) failures.push(`${url}: missing noindex`);
      for (const width of [360, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const layout = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          width: innerWidth,
          bottomNav: [...document.querySelectorAll("nav")].some((node) => getComputedStyle(node).position === "fixed" && getComputedStyle(node).display !== "none"),
          visibleHeadings: [...document.querySelectorAll("h1")].filter((node) => node.getBoundingClientRect().height > 0).length,
          smallControls: [...document.querySelectorAll("button, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, summary")]
            .filter((node) => getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none" && node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 43.5)
            .map((node) => node.outerHTML.slice(0, 120)),
        }));
        if (layout.scrollWidth > width + 1) failures.push(`${url} ${width}px: horizontal overflow ${layout.scrollWidth}`);
        if (layout.bottomNav !== (width < 768)) failures.push(`${url} ${width}px: incorrect navigation`);
        if (layout.visibleHeadings !== 1) failures.push(`${url} ${width}px: H1 hidden`);
        if (layout.smallControls.length) failures.push(`${url} ${width}px: controls below 44px: ${layout.smallControls.join(", ")}`);
        if (["", "/places", "/nearby", "/contact"].includes(route) && [360, 1440].includes(width)) await page.screenshot({ path: path.join(output, `${locale}-${route.slice(1) || "home"}-${width}.png`), fullPage: true });
      }
      results.push({ url, ...info });
      console.log(`${url}: audited at six widths`);
    }
    await page.close();
  }
  const page = await browser.newPage();
  for (const resource of ["/robots.txt", "/sitemap.xml", "/og.png"]) {
    const response = await page.request.get(base + resource);
    assert.equal(response.status(), 200, resource);
    if (resource === "/robots.txt") assert.match(await response.text(), /Sitemap: https?:\/\/.+\/sitemap.xml/);
    if (resource === "/sitemap.xml") assert.doesNotMatch(await response.text(), /\/(saved|login|mypage|itinerary|admin)</);
    if (resource === "/og.png") assert.match(response.headers()["content-type"], /image\/png/);
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ results, failures }, null, 2));
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`Public page audit passed: ${results.length} pages, six widths, metadata and crawl endpoints.`);
