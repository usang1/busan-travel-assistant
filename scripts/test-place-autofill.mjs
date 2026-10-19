import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

function loadTsModule(path, aliases = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } });
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier in aliases) return aliases[specifier];
    throw new Error(`Unexpected import ${specifier} in ${path}`);
  };
  new Script(outputText, { filename: path }).runInNewContext({ module, exports: module.exports, require, console, process, URL, AbortController, setTimeout, clearTimeout, Promise });
  return module.exports;
}

const normalize = loadTsModule("lib/place-providers/normalize.ts", {
  "@/lib/map-url": {
    normalizeLatitude: (value) => { const number = Number(value); return Number.isFinite(number) && number >= -90 && number <= 90 ? number : null; },
    normalizeLongitude: (value) => { const number = Number(value); return Number.isFinite(number) && number >= -180 && number <= 180 ? number : null; },
  },
});
const google = loadTsModule("lib/place-providers/google.ts", { "@/lib/place-providers/normalize": normalize });
const autofill = loadTsModule("lib/place-autofill.ts");
const providerFetch = loadTsModule("lib/provider-fetch.ts");
const enrichment = loadTsModule("lib/admin-place-enrichment.ts", {
  "@/lib/place-providers/normalize": normalize,
  "@/lib/place-ai/locale-validation": { sanitizeLocalizedAddress: (value) => value },
  "@/lib/city-regions": { inferPlaceCity: () => "busan", inferCityRegion: () => "suyeong" },
});

const completeGoogle = google.normalizeGooglePlace({
  id: "ChIJ-test",
  displayName: { text: "테스트 식당" },
  formattedAddress: "부산광역시 수영구 테스트로 1",
  location: { latitude: 35.15, longitude: 129.11 },
  nationalPhoneNumber: "051-111-2222",
  primaryTypeDisplayName: { text: "음식점" },
  regularOpeningHours: { weekdayText: ["Monday: Closed", "Tuesday: 11:00 AM–9:00 PM"] },
});
assert.deepEqual([...completeGoogle.openingHours], ["Monday: Closed", "Tuesday: 11:00 AM–9:00 PM"], "alternate weekdayText response must normalize");
assert.deepEqual([...completeGoogle.closedDays], ["Monday: Closed"], "closed days must be extracted from provider hours");

const completeResults = autofill.buildAutofillFieldResults({
  place: { provider: "google", sourceUrl: "https://maps.google.com", ...completeGoogle, menu: [{ name: "국밥", price: 10000, description: "돼지고기 국밥" }] },
  provider: "google",
});
assert.equal(completeResults.find((item) => item.field === "openingHours").status, "auto_filled");
assert.equal(completeResults.find((item) => item.field === "menuPrice").status, "auto_filled");
assert.equal(completeResults.find((item) => item.field === "menuDescription").status, "auto_filled");

const sparseResults = autofill.buildAutofillFieldResults({
  place: { provider: "kakao", sourceUrl: "https://place.map.kakao.com/1", name: "메뉴 없는 식당" },
  provider: "kakao",
});
assert.equal(sparseResults.find((item) => item.field === "menu").status, "no_data");
assert.equal(sparseResults.find((item) => item.field === "openingHours").retryable, true);
assert.equal(sparseResults.find((item) => item.field === "payment").reasonCode, "SOURCE_NOT_SUPPORTED");

const failedResults = autofill.buildAutofillFieldResults({
  place: { provider: "naver", sourceUrl: "https://map.naver.com" }, provider: "naver", lookupFailed: true,
});
assert.equal(failedResults.find((item) => item.field === "phone").status, "lookup_failed");

const baseForm = {
  source_url: "", provider: "MANUAL", source_external_id: "", name_ko: "관리자 이름", name_zh: "", category: "", city: "", region_key: "",
  address_ko: "관리자 주소", address_zh: "", address_en: "", address_ja: "", latitude: "", longitude: "", phone: "", website: "",
  opening_hours: "", closed_days: "", price_level: "", price_min: "", price_max: "", thumbnail_url: "", provider_image_preview_url: "",
  provider_image_attribution: "", nearest_station: "", walking_minutes: "", provider_rating: "", provider_review_count: "", provider_amenities: "",
  source_metadata: null, source_fetched_at: "",
};
const first = enrichment.enrichPlaceForm(baseForm, { provider: "google", sourceUrl: "https://maps.google.com", name: "외부 이름", addressKo: "외부 주소", openingHours: "11:00-21:00", closedDays: "월요일 휴무" });
assert.equal(first.name_ko, "관리자 이름", "manual name must not be overwritten");
assert.equal(first.address_ko, "관리자 주소", "manual address must not be overwritten");
assert.equal(first.opening_hours, "11:00-21:00");
assert.equal(first.closed_days, "월요일 휴무", "closed days must reach the form");
const rerun = enrichment.enrichPlaceForm({ ...first, opening_hours: "관리자 수정 시간", closed_days: "관리자 수정 휴무" }, { provider: "google", sourceUrl: "https://maps.google.com", openingHours: "09:00-18:00", closedDays: "화요일 휴무" });
assert.equal(rerun.opening_hours, "관리자 수정 시간", "rerun must preserve manual opening hours");
assert.equal(rerun.closed_days, "관리자 수정 휴무", "rerun must preserve manual closed days");

let attempts = 0;
const retryingFetch = providerFetch.createProviderFetcher(async () => {
  attempts += 1;
  return new Response("{}", { status: attempts === 1 ? 503 : 200 });
}, { timeoutMs: 100, retries: 1, retryDelayMs: 0 });
assert.equal((await retryingFetch("https://example.com")).status, 200);
assert.equal(attempts, 2, "retryable provider failures must retry once");

const timeoutFetch = providerFetch.createProviderFetcher((_input, init) => new Promise((_resolve, reject) => {
  init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
}), { timeoutMs: 5, retries: 0 });
await assert.rejects(() => timeoutFetch("https://example.com"), (error) => error.code === "PROVIDER_TIMEOUT");

const migration = readFileSync(new URL("../supabase/migrations/056_place_autofill_diagnostics.sql", import.meta.url), "utf8");
assert.match(migration, /enable row level security/);
assert.match(migration, /field_results jsonb/);
assert.doesNotMatch(migration, /raw_response|api_key|token/i, "diagnostics migration must not store secrets or raw responses");

console.log("Place autofill diagnostics and fallback tests passed (complete, sparse, alternate response, retry, timeout, manual preservation).");
