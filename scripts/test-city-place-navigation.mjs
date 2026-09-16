import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PUBLIC_BROWSER_BASE_URL || "http://localhost:3011";
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${base}/ko`, { waitUntil: "networkidle" });
    for (const [city, district] of [["서울", "강남구"], ["부산", "수영구"], ["제주", "제주시"]]) {
      await page.getByRole("link", { name: city, exact: true }).click();
      await page.getByRole("link", { name: district, exact: true }).waitFor();
      await page.getByRole("link", { name: city, exact: true }).click();
      await page.getByRole("link", { name: district, exact: true }).waitFor({ state: "hidden" });
    }

    await page.goto(`${base}/ko/nearby`, { waitUntil: "networkidle" });
    if (width < 1024) {
      await page.locator('button[aria-controls="nearby-mobile-list"]').click();
    }
    const detail = page.getByRole("link", { name: / 상세$/ }).first();
    await detail.waitFor();
    const href = await detail.getAttribute("href");
    await detail.click();
    await page.waitForURL((url) => url.pathname === new URL(href, base).pathname);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.ok(!(await page.title()).includes("500"));

    // A fresh request exercises production rendering, not just client navigation.
    const response = await page.reload({ waitUntil: "networkidle" });
    assert.equal(response.status(), 200, `Detail reload at ${width}px`);
    assert.equal(await page.locator("html#__next_error__").count(), 0);
    await page.screenshot({ path: `/tmp/busan-detail-${width}.png`, fullPage: true });
    const missing = await page.goto(`${base}/ko/places/nonexistent-navigation-regression`);
    assert.equal(missing.status(), 404, "Missing places must not return a server error");
    await page.close();
    console.log(`City toggle and nearby detail navigation passed at ${width}px`);
  }
} finally {
  await browser.close();
}
