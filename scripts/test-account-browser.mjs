import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.PUBLIC_BROWSER_BASE_URL || "http://localhost:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Mocked account checks must run locally");
const config = readFileSync(".env.local", "utf8");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || config.match(/^NEXT_PUBLIC_SUPABASE_URL=["']?([^\s"']+)/m)?.[1];
assert.ok(supabaseUrl, "Local Supabase public URL is needed for browser session mocks");
const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";
const sessionFor = (id) => ({
  access_token: `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.mock`,
  refresh_token: "mock-refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id, aud: "authenticated", role: "authenticated", email: "audit@example.invalid", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
});
const profileFor = (id, role = "tourist") => ({ id, role, display_name: "Audit traveler", preferred_locale: "en", onboarding_completed: false });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
async function contextWithSession(profileHandler, seedSession = true) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (seedSession) await context.addInitScript(({ key, session, origin }) => {
    if (location.origin === origin) localStorage.setItem(key, JSON.stringify(session));
  }, { key: storageKey, session: sessionFor(firstUser), origin: new URL(base).origin });
  // All browser-side backend requests are mocked; no test account or production write is made.
  await context.route(`${new URL(supabaseUrl).origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/rest/v1/profiles") return profileHandler(route, url.searchParams.get("id")?.replace("eq.", ""));
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await context.route(`${base}/api/**`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"mock unavailable"}' }));
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  return context;
}
try {
  const context = await contextWithSession((route, id) => route.fulfill({ json: [profileFor(id)] }));
  const page = await context.newPage();
  const labels = { ko: ["회원 정보 설정", "닉네임 또는 이름", "계속"], zh: ["完善账户信息", "昵称或姓名", "继续"], en: ["Set up your account", "Nickname or name", "Continue"], ja: ["アカウント設定", "ニックネームまたは名前", "続ける"] };
  for (const [locale, [title, name]] of Object.entries(labels)) {
    await page.goto(`${base}/${locale}/onboarding`, { waitUntil: "networkidle", timeout: 90000 });
    assert.equal(await page.locator("h1").innerText(), title);
    assert.equal(await page.getByRole("textbox", { name }).inputValue(), "Audit traveler");
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
    assert.equal(await page.locator('main a[href$="/terms"]').count(), 1);
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
  }
  await page.goto(`${base}/en/onboarding`, { waitUntil: "networkidle" });
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  let submissions = 0;
  let releaseSubmission;
  const pendingSubmission = new Promise((resolve) => { releaseSubmission = resolve; });
  await page.route("**/api/profile/onboarding", async (route) => {
    submissions++;
    await pendingSubmission;
    await route.fulfill({ status: 503, json: { message: "unavailable" } });
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('form[aria-busy="true"] button[type="submit"]')?.disabled);
  assert.equal(submissions, 1);
  releaseSubmission();
  await page.getByRole("alert").filter({ hasText: "Could not save" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Continue", exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole("textbox", { name: "Nickname or name" }).inputValue(), "Audit traveler");

  await page.goto(`${base}/en/business/dashboard`, { waitUntil: "networkidle" });
  await page.getByRole("alert").filter({ hasText: "Could not load" }).waitFor();
  await page.route("**/api/business/dashboard", (route) => route.fulfill({ json: { applications: [], memberships: [], changes: [], places: [] } }));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("link", { name: "Apply again", exact: true }).waitFor();
  assert.equal(await page.locator("h1").count(), 1);
  await context.close();

  let profileFails = true;
  const retryContext = await contextWithSession((route, id) => route.fulfill(profileFails ? { status: 500, json: { message: "unavailable" } } : { json: [profileFor(id)] }));
  const retryPage = await retryContext.newPage();
  await retryPage.goto(`${base}/en/onboarding`, { waitUntil: "networkidle" });
  await retryPage.getByRole("button", { name: "Try again", exact: true }).waitFor();
  profileFails = false;
  await retryPage.getByRole("button", { name: "Try again", exact: true }).click();
  await retryPage.getByRole("textbox", { name: "Nickname or name" }).waitFor();
  await retryContext.close();

  let finishLoginProfile;
  const loginProfile = new Promise((resolve) => { finishLoginProfile = resolve; });
  const loginContext = await contextWithSession(async (route, id) => {
    await loginProfile;
    await route.fulfill({ json: [profileFor(id)] });
  }, false);
  const loginPage = await loginContext.newPage();
  await loginPage.route("**/auth/v1/token*", (route) => route.fulfill({ json: sessionFor(firstUser) }));
  await loginPage.goto(`${base}/en/login?next=%2Fen%2Fsaved`, { waitUntil: "networkidle" });
  await loginPage.getByRole("textbox", { name: "Email", exact: true }).fill("audit@example.invalid");
  await loginPage.getByLabel("Password", { exact: true }).fill("Audit1234!");
  await loginPage.locator('form button[type="submit"]').click();
  assert.equal(new URL(loginPage.url()).pathname, "/en/login", "Wait for profile before deciding the post-login destination");
  finishLoginProfile();
  await loginPage.waitForURL((url) => url.pathname === "/en/onboarding" && url.searchParams.get("next") === "/en/saved");
  await loginContext.close();

  let releaseProfile;
  const pendingProfile = new Promise((resolve) => { releaseProfile = resolve; });
  let firstProfileRequested;
  const profileRequested = new Promise((resolve) => { firstProfileRequested = resolve; });
  const raceContext = await contextWithSession(async (route, id) => {
    if (id === firstUser) { firstProfileRequested(); await pendingProfile; }
    await route.fulfill({ json: [profileFor(id, id === firstUser ? "admin" : "tourist")] });
  });
  const racePage = await raceContext.newPage();
  await racePage.goto(`${base}/en/onboarding`, { waitUntil: "domcontentloaded" });
  await profileRequested;
  await racePage.evaluate(({ key, session }) => { const channel = new BroadcastChannel(key); channel.postMessage({ event: "SIGNED_IN", session }); channel.close(); }, { key: storageKey, session: sessionFor(secondUser) });
  await racePage.getByRole("textbox", { name: "Nickname or name" }).waitFor();
  releaseProfile();
  await racePage.waitForLoadState("networkidle");
  assert.equal(await racePage.locator('header a[href="/en/admin"]').count(), 0, "Late previous-account profile must never grant admin UI to the current user");
  await raceContext.close();

  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage disabled", "SecurityError"); } }); });
  const blockedPage = await blockedContext.newPage();
  blockedPage.on("pageerror", (error) => errors.push(error.message));
  await blockedPage.goto(`${base}/en/places`, { waitUntil: "networkidle", timeout: 90000 });
  assert.equal(await blockedPage.locator("h1").count(), 1);
  assert.equal(await blockedPage.locator("main input").first().isVisible(), true);
  await blockedContext.close();
  assert.deepEqual(errors, []);
  console.log("Account browser checks passed: four locales, four widths, duplicate submit, network recovery, profile retry, account race, and blocked storage.");
} finally { await browser.close(); }
