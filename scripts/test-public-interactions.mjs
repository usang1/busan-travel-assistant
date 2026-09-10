import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.BROWSER_TEST_MODULE ? pathToFileURL(process.env.BROWSER_TEST_MODULE).href : "playwright");
const base = process.env.PUBLIC_BROWSER_BASE_URL || "http://localhost:3100";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  for (const [locale, query, category] of [["ko", "카페", "카페"], ["zh", "咖啡", "咖啡"], ["en", "cafe", "Cafes"], ["ja", "カフェ", "カフェ"]]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
    for (const method of ["enter", "button", "composition"]) {
      await page.goto(`${base}/${locale}`, { waitUntil: "networkidle" });
      const input = page.locator('form[role="search"] input');
      await input.fill(`  ${query}  `);
      if (method === "composition") {
        await input.dispatchEvent("compositionstart");
        await input.press("Enter");
        assert.equal(new URL(page.url()).pathname, `/${locale}`);
        await input.dispatchEvent("compositionend");
      }
      if (method === "button") await page.locator('form[role="search"] button[type="submit"]').click();
      else await input.press("Enter");
      await page.waitForURL((url) => url.pathname === `/${locale}/places` && url.searchParams.get("search") === query);
      assert.equal(await page.locator("main input").first().inputValue(), query);
      await page.getByRole("button", { name: category, exact: true }).first().click();
      await page.waitForURL((url) => url.searchParams.get("category") === "cafe");
      assert.equal(new URL(page.url()).searchParams.get("search"), query);
      await page.goBack();
      await page.waitForURL((url) => url.pathname === `/${locale}`);
    }
    await page.locator('form[role="search"] input').fill("   ");
    await page.locator('form[role="search"] input').press("Enter");
    await page.waitForURL((url) => url.pathname === `/${locale}/places` && !url.search);
    await page.goto(`${base}/${locale}/nearby`, { waitUntil: "networkidle" });
    const toggle = page.locator('[aria-controls="nearby-mobile-list"]');
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#nearby-mobile-list").isVisible(), true);
    await toggle.click();
    assert.equal(await page.locator("#nearby-mobile-list").isVisible(), false);
    await page.goto(`${base}/${locale}/translator`, { waitUntil: "networkidle" });
    await page.locator("main button").filter({ has: page.locator('p[lang="ko"]') }).first().click();
    assert.equal(await page.locator("dialog").isVisible(), true);
    await page.keyboard.press("Escape");
    await page.locator("dialog").waitFor({ state: "detached" });
    await page.close();
    console.log(`${locale}: search, category, Enter/IME, back, blank query, map/list and accessible phrase dialog passed`);
  }
} finally { await browser.close(); }
