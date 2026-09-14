import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
const state = {
  guides: [],
  photoSpots: [],
  places: [],
};

function compileTs(filename, requireHandler) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    { exports: module.exports, module, require: requireHandler, console, process, URL, Date, Set, Map },
    { filename },
  );
  return module.exports;
}

function load(request) {
  if (!request.startsWith("@/")) return require(request);
  if (cache.has(request)) return cache.get(request);

  if (request === "@/config/site") {
    return { absoluteUrl: (pathname = "/") => `https://example.com${pathname}`, siteConfig: { url: "https://example.com" } };
  }
  if (request === "@/lib/guide-store") {
    return {
      createPublicGuideClient: () => ({}),
      getPublishedGuides: async () => ({ guides: state.guides, unavailable: false }),
    };
  }
  if (request === "@/lib/photo-spot-store") {
    return { getPhotoSpots: async () => ({ photoSpots: state.photoSpots, source: "supabase" }) };
  }
  if (request === "@/lib/place-store") {
    return { getPlaces: async () => ({ places: state.places, source: "supabase" }) };
  }
  if (request === "@/lib/public-seo") {
    return {
      translatedGuideLocales: (guide) => ["zh", "en", "ja", "ko"].filter((locale) => guide[`title_${locale}`]?.trim() && guide[`description_${locale}`]?.trim()),
      translatedPlaceLocales: (place) => place.locales ?? [],
    };
  }

  const stem = path.resolve(request.slice(2));
  const filename = [stem + ".ts", stem + ".tsx"].find(fs.existsSync);
  if (!filename) throw new Error(`Unexpected import: ${request}`);
  const exports = compileTs(filename, load);
  cache.set(request, exports);
  return exports;
}

const i18n = load("@/lib/i18n");
const sitemapModule = compileTs("app/sitemap.ts", load);
const sitemap = sitemapModule.default;

for (const locale of i18n.locales) {
  assert.ok(i18n.ui[locale].notFound.title);
  assert.ok(i18n.ui[locale].notFound.description);
  assert.ok(i18n.ui[locale].notFound.home);
}

const notFoundSource = fs.readFileSync("app/not-found.tsx", "utf8");
assert.match(notFoundSource, /getLocaleFromPath/);
assert.match(notFoundSource, /content="nofollow"/);
assert.doesNotMatch(notFoundSource, /没有找到页面|回到首页/);

const adminPageSource = fs.readFileSync("app/admin/page.tsx", "utf8");
const adminShellSource = fs.readFileSync("components/AdminShell.tsx", "utf8");
assert.equal((adminPageSource.match(/<h1\b/g) ?? []).length, 1);
assert.equal((adminShellSource.match(/<h1\b/g) ?? []).length, 0);
assert.doesNotMatch(adminPageSource, /韩国旅行助手/);
assert.match(adminShellSource, /withLocale\("\/login", locale\)/);

const loginSource = fs.readFileSync("components/LoginForm.tsx", "utf8");
assert.match(loginSource, /signinTitle/);
assert.match(loginSource, /signupTitle/);
assert.match(loginSource, /signinDescription/);
assert.match(loginSource, /signupDescription/);
assert.match(loginSource, /auth_signin_submit/);
assert.match(loginSource, /auth_signup_submit/);
assert.match(loginSource, /current-password/);
assert.match(loginSource, /new-password/);

const mypageSource = fs.readFileSync("components/MyPageView.tsx", "utf8");
assert.match(mypageSource, /mypage\.loginTitle/);
assert.doesNotMatch(mypageSource, /title=\{copy\.mypage\.title\}/);

const indexed = i18n.buildLocalizedMetadata({ locale: "ko", title: "정상 페이지", description: "설명", path: "/places" });
assert.equal(new URL(indexed.alternates.canonical).pathname, "/ko/places");
assert.ok(indexed.alternates.languages["x-default"]);
assert.equal(indexed.robots, undefined);

const noindexed = i18n.buildLocalizedMetadata({ locale: "ko", title: "빈 페이지", description: "설명", path: "/guides", noIndex: true, follow: true });
assert.equal(new URL(noindexed.alternates.canonical).pathname, "/ko/guides");
assert.equal(Object.keys(noindexed.alternates.languages).length, 0);
assert.equal(noindexed.robots.index, false);
assert.equal(noindexed.robots.follow, true);

state.guides = [];
state.photoSpots = [];
state.places = [];
let entries = await sitemap();
let paths = entries.map((entry) => new URL(entry.url).pathname);
assert.ok(paths.includes("/ko/places"));
assert.ok(!paths.some((pathname) => pathname.endsWith("/guides")));
assert.ok(!paths.some((pathname) => pathname.endsWith("/photo-spots")));
assert.ok(!paths.some((pathname) => pathname.endsWith("/luggage")));

state.guides = [{ title_ko: "가이드", description_ko: "설명", title_zh: "", description_zh: "", title_en: "", description_en: "", title_ja: "", description_ja: "" }];
state.photoSpots = [{ id: "spot-1", slug: "spot-1", is_active: true, free_or_pro: "free", name_zh: "拍照点", updated_at: "2026-01-01T00:00:00.000Z" }];
state.places = [{ id: "luggage-1", slug: "luggage-1", category: "luggage", updated_at: "2026-01-01T00:00:00.000Z", locales: ["ko", "zh"] }];
entries = await sitemap();
paths = entries.map((entry) => new URL(entry.url).pathname);
assert.ok(paths.includes("/ko/guides"));
assert.ok(!paths.includes("/en/guides"));
assert.ok(paths.includes("/ko/photo-spots"));
assert.ok(paths.includes("/ko/luggage"));

console.log("Locale/indexability tests passed: 404, admin headings, auth modes, mypage headings, metadata and sitemap state transitions.");
