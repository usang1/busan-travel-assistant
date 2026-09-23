import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function compile(path, modules) {
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => modules[name] ?? {});
  return module.exports;
}

const social = compile("../lib/social-discovery.ts", {
  "@/lib/i18n": { getPlaceContent: (place) => ({ name: place.name_zh || place.name_ko, address: place.address_zh || place.address_ko }) },
  "@/lib/place-display": { getRepresentativeMenu: (place) => place.menu_items[0] ? { name: place.menu_items[0].name_zh || place.menu_items[0].name_ko } : null },
  "@/lib/place-trust": {
    getPlaceCategoryLabel: (category) => category,
    getPlaceNameDisplay: (place) => ({ name: place.name_zh || place.name_ko, secondaryName: place.name_ko }),
    getTrustedPlaceImageUrl: (place) => place.thumbnail_url,
  },
});

const normalized = social.normalizePublicSocialUrl("https://www.xiaohongshu.com/explore/abc?token=secret&utm_source=test#profile");
assert.equal(normalized.platform, "xiaohongshu");
assert.equal(normalized.normalizedUrl, "https://xiaohongshu.com/explore/abc");
assert.throws(() => social.normalizePublicSocialUrl("http://127.0.0.1:3000/private"), /private_host_not_allowed/);
assert.throws(() => social.normalizePublicSocialUrl("file:///etc/passwd"), /unsupported_protocol/);
assert.throws(() => social.normalizePublicSocialUrl("https://example.com/post/1"), /unsupported_social_host/);

const clues = social.extractSocialClues("#광안리 하우스멜 소금빵 광안역 1번 출구 8,000원");
assert.ok(clues.placeTerms.includes("하우스멜"));
assert.ok(clues.regionTerms.includes("광안리"));
assert.ok(clues.stationTerms.includes("광안역"));
assert.ok(clues.priceTerms.includes("8,000원"));

const base = {
  slug: "house-mel", name_zh: "House Mel", name_ko: "하우스멜", category: "cafe", district_code: "suyeong-gu",
  address_ko: "부산광역시 수영구 광안로", address_zh: "釜山广域市水营区", nearest_station: "광안역", menu_items: [{ name_ko: "소금빵", name_zh: "盐面包" }],
  tags: [], translations: [], thumbnail_url: "", latitude: 35.1, longitude: 129.1, save_count: 0,
};
const exact = social.matchSocialPlaces([{ ...base, id: "busan-1" }], clues, "ko", []);
assert.equal(exact[0].id, "busan-1");
assert.ok(exact[0].confidence >= 55);
const regionOnly = social.matchSocialPlaces([{ ...base, id: "busan-1" }], social.extractSocialClues("광안리 여행 추천"), "ko", []);
assert.equal(regionOnly.length, 0, "A region-only clue must not identify a business");
const approvedAlias = social.matchSocialPlaces([{ ...base, id: "busan-1" }], social.extractSocialClues("海边绿色葡萄面包店"), "zh", [{ alias: "海边绿色葡萄面包店", placeId: "busan-1" }]);
assert.equal(approvedAlias[0].matchSource, "approved_alias");
assert.equal(approvedAlias[0].confidence, 98);

const migration = read("../supabase/migrations/034_social_discovery_matching.sql");
assert.match(migration, /register_social_discovery_request/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /interval '1 hour'/);
assert.match(migration, /interval '24 hours'/);
assert.match(migration, /grant execute on function public\.register_social_discovery_request[\s\S]+to service_role/);
assert.match(migration, /Raw social text, URLs, screenshots, IP addresses, and OCR images are not stored/);

const searchRoute = read("../app/api/social-discovery/search/route.ts");
assert.match(searchRoute, /getCachedPublicPlaces\(localeValue as Locale, "busan"\)/);
assert.match(searchRoute, /isSameRequestOrigin/);
assert.match(searchRoute, /createHash\("sha256"\)/);
assert.doesNotMatch(searchRoute, /fetch\(socialUrl|fetch\(inputText|x-forwarded-for|cf-connecting-ip|request\.ip/);
const server = read("../lib/social-discovery-server.ts");
assert.match(server, /httpOnly: true/);
assert.match(server, /sameSite: "lax"/);
assert.match(server, /createHmac\("sha256"/);
const ocr = read("../lib/social-discovery-ocr.ts");
assert.match(ocr, /store: false/);
assert.match(ocr, /image\/jpeg.*image\/png.*image\/webp/);
assert.doesNotMatch(ocr, /writeFile|storage\.from|\.upload\(/);

const finder = read("../components/SocialPlaceFinder.tsx");
assert.match(finder, /<SaveButton/);
assert.match(finder, /<AddToTripButton/);
assert.match(finder, /<DirectionsButton/);
assert.match(finder, /이 장소가 맞아요/);
assert.match(read("../app/[locale]/social-find/page.tsx"), /候选不会自动确认/);
const admin = read("../components/AdminSocialDiscoveryManager.tsx");
assert.match(admin, /낮은 신뢰도/);
assert.match(admin, /중복 후보/);
assert.match(admin, /매핑 해제/);

console.log("Social discovery URL safety, clue matching, privacy, rate limiting, candidate actions, and admin moderation tests passed.");
