import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, modules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected import: ${name}`);
  });
  return module.exports;
}

const validation = compile("../lib/business-application.ts", {
  "@/lib/map-url": {
    parseMapUrl(value) {
      const url = new URL(value);
      const provider = ["naver.me", "map.naver.com", "www.map.naver.com", "m.map.naver.com", "place.naver.com", "www.place.naver.com", "m.place.naver.com"].includes(url.hostname)
        ? "naver"
        : "unknown";
      const placeId = url.pathname.match(/\/(?:entry\/place|place|restaurant|cafe)\/(\d+)/u)?.[1];
      return { provider, sourceProvider: provider === "naver" ? "NAVER" : "MANUAL", normalizedUrl: url.toString(), placeId };
    },
  },
});

assert.equal(validation.normalizeNaverPlaceUrl("https://naver.me/AbCdEf12"), "https://naver.me/AbCdEf12");
assert.equal(validation.normalizeNaverPlaceUrl("https://map.naver.com/p/entry/place/1234567890?c=15.00"), "https://map.naver.com/p/entry/place/1234567890");
assert.equal(validation.normalizeNaverPlaceUrl("https://place.naver.com/restaurant/1234567890/home"), "https://map.naver.com/p/entry/place/1234567890");
assert.equal(validation.normalizeNaverPlaceUrl("https://map.naver.com/p/search/test"), null, "a generic Naver search URL is not a place detail URL");
assert.equal(validation.normalizeNaverPlaceUrl("https://place.map.kakao.com/123"), null);
assert.equal(validation.normalizeNaverPlaceUrl("http://naver.me/AbCdEf12"), null, "only HTTPS links are accepted");

assert.equal(validation.normalizeKoreanMobilePhone("010 1234 5678"), "010-1234-5678");
assert.equal(validation.normalizeKoreanMobilePhone("+82 10-1234-5678"), "010-1234-5678");
assert.equal(validation.normalizeKoreanMobilePhone("02-123-4567"), null);
assert.equal(validation.formatKoreanMobilePhoneInput("01012345678"), "010-1234-5678");
assert.equal(validation.normalizeApplicantName("  홍   길동 "), "홍 길동");
assert.equal(validation.normalizeApplicantName("   "), null);

const validInput = {
  placeUrl: "https://naver.me/AbCdEf12",
  applicantName: "홍길동",
  applicantRole: "agency",
  contactPhone: "01012345678",
  privacyConsent: true,
  consentVersion: validation.BUSINESS_APPLICATION_CONSENT_VERSION,
};
assert.equal(validation.validateBusinessApplicationInput(validInput).ok, true);
assert.deepEqual(validation.validateBusinessApplicationInput({ ...validInput, applicantRole: "admin" }), { ok: false, code: "invalid_applicant_role", field: "applicantRole" });
assert.deepEqual(validation.validateBusinessApplicationInput({ ...validInput, privacyConsent: false }), { ok: false, code: "consent_required", field: "privacyConsent" });
assert.deepEqual(validation.validateBusinessApplicationInput({ ...validInput, consentVersion: "old" }), { ok: false, code: "consent_version_mismatch", field: "privacyConsent" });

const migration = readFileSync(new URL("../supabase/migrations/048_business_application_intake.sql", import.meta.url), "utf8");
assert.match(migration, /add column if not exists applicant_role text/);
assert.match(migration, /add column if not exists consent_version text/);
assert.match(migration, /function public\.submit_business_application/);
assert.match(migration, /security definer/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /requested_applicant_role not in \('owner', 'staff', 'agency'\)/);
assert.match(migration, /when unique_violation[\s\S]*duplicate_application/, "duplicate retries must be idempotently rejected");
assert.match(migration, /duplicate_key = duplicate_value and status <> 'rejected'/, "approved and in-review businesses must not be submitted again");
assert.match(migration, /created_at >= now\(\) - interval '24 hours'\) >= 5[\s\S]*rate_limited/, "repeated submissions must be rate limited");
assert.match(migration, /revoke insert on public\.business_applications from authenticated/, "direct inserts must not bypass intake validation");
assert.match(migration, /status, duplicate_key[\s\S]*'pending'/, "new applications must remain pending");

const route = readFileSync(new URL("../app/api/business-applications/route.ts", import.meta.url), "utf8");
assert.match(route, /validateBusinessApplicationInput/);
assert.match(route, /rpc\("submit_business_application"/);
assert.match(route, /createLegacyCompatibleApplication/, "rolling deploys must retain a compatible intake path");
assert.match(route, /if \(error\.code === "PGRST202"[\s\S]*createLegacyCompatibleApplication/, "the legacy path may run only when the RPC is absent");
assert.doesNotMatch(route, /process\.stderr\.write\([^\n]*contactPhone/, "phone numbers must not be logged");
assert.match(route, /cross_site_blocked/);

let rpcResult = { ok: true, code: "created", application_id: "11111111-1111-4111-8111-111111111111" };
let rpcInput;
let authenticated = true;
let rpcError = null;
let legacyInsert;
const profileQuery = {
  select: () => profileQuery,
  eq: () => profileQuery,
  single: async () => ({ data: { role: "tourist", display_name: "홍길동" }, error: null }),
};
const client = {
  auth: { getUser: async () => authenticated ? { data: { user: { id: "user-1" } }, error: null } : { data: { user: null }, error: { message: "expired" } } },
  from: (table) => {
    if (table === "profiles") return profileQuery;
    assert.equal(table, "business_applications");
    const query = {
      select: () => query,
      eq: () => query,
      neq: () => query,
      limit: async () => ({ data: [], error: null }),
      insert: (value) => { legacyInsert = value; return query; },
      single: async () => ({ data: { id: "22222222-2222-4222-8222-222222222222" }, error: null }),
    };
    return query;
  },
  rpc: async (name, input) => {
    assert.equal(name, "submit_business_application");
    rpcInput = input;
    return { data: rpcResult, error: rpcError };
  },
};
const serviceClient = { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) };
const response = { json: (body, init = {}) => ({ status: init.status ?? 200, body }) };
const routeModule = compile("../app/api/business-applications/route.ts", {
  "node:crypto": { createHash },
  "next/server": { NextResponse: response },
  "@/lib/map-url": { parseMapUrl: (value) => ({ provider: "naver", sourceProvider: "NAVER", normalizedUrl: value, placeId: value.match(/\d+$/u)?.[0] }) },
  "@/lib/server-supabase": { createServerAnonClient: () => client, createServerServiceClient: () => serviceClient },
  "@/lib/telegram": { sendBusinessApplicationNotification: async () => ({ ok: true, skipped: false }) },
  "@/lib/i18n": { isLocale: (value) => ["ko", "zh", "en", "ja"].includes(value) },
  "@/lib/business-application": validation,
});
function request(body, options = {}) {
  const headers = new Map([
    ["origin", options.origin ?? "https://spotzari.com"],
    ...(options.auth === false ? [] : [["authorization", "Bearer valid-token"]]),
  ]);
  return { url: "https://spotzari.com/api/business-applications", headers: { get: (name) => headers.get(name.toLowerCase()) ?? null }, text: async () => JSON.stringify(body) };
}

let apiResult = await routeModule.POST(request({ ...validInput, locale: "ko" }));
assert.equal(apiResult.status, 201);
assert.equal(rpcInput.requested_applicant_role, "agency");
assert.equal(rpcInput.contact_phone, "010-1234-5678");
assert.equal(rpcInput.accepted_consent_version, validation.BUSINESS_APPLICATION_CONSENT_VERSION);

rpcResult = { ok: false, code: "duplicate_application" };
apiResult = await routeModule.POST(request({ ...validInput, locale: "ko" }));
assert.equal(apiResult.status, 409);
assert.equal(apiResult.body.code, "duplicate_application");
apiResult = await routeModule.POST(request({ ...validInput, privacyConsent: false, locale: "ko" }));
assert.equal(apiResult.status, 400);
assert.equal(apiResult.body.field, "privacyConsent");
apiResult = await routeModule.POST(request({ ...validInput, locale: "ko" }, { origin: "https://attacker.example" }));
assert.equal(apiResult.status, 403);
authenticated = false;
apiResult = await routeModule.POST(request({ ...validInput, locale: "ko" }));
assert.equal(apiResult.status, 401);
authenticated = true;
rpcError = { code: "PGRST202", message: "Could not find function public.submit_business_application" };
apiResult = await routeModule.POST(request({ ...validInput, locale: "ko" }));
assert.equal(apiResult.status, 201, "the API must accept applications during a deployment where migration 048 is not applied yet");
assert.equal(legacyInsert.applicant_relationship, "agency");
assert.equal(legacyInsert.privacy_consent_at.length > 0, true);
assert.equal(legacyInsert.request_notes.includes(validation.BUSINESS_APPLICATION_CONSENT_VERSION), true, "the accepted notice version must survive on the legacy schema");
assert.equal(legacyInsert.status, undefined, "the applicant must not set review status");
rpcError = null;

const form = readFileSync(new URL("../components/BusinessApplicationForm.tsx", import.meta.url), "utf8");
for (const role of ["owner", "staff", "agency"]) assert.match(form, new RegExp(`value: "${role}"`));
for (const text of ["Spotzari 입점신청", "Spotzari 商家入驻", "Spotzari business application", "Spotzari 店舗掲載申請"]) assert.match(form, new RegExp(text));
assert.match(form, /inputMode="numeric"/);
assert.match(form, /aria-invalid/);
assert.match(form, /disabled=\{!isReady \|\| saving \|\| completed\}/);
assert.match(form, /withLocale\("\/privacy", locale\)/);
assert.match(form, /BUSINESS_APPLICATION_CONSENT_VERSION/);

const admin = readFileSync(new URL("../components/AdminBusinessApplications.tsx", import.meta.url), "utf8");
assert.match(admin, /신청 지도 링크 열기/);
assert.match(admin, /applicantRoleLabel/);
assert.match(admin, /toLocaleString\("ko-KR"\)/);

console.log("Business application intake tests passed: Naver URL, applicant role, phone, consent, RPC security, duplicate handling, responsive form and admin fields.");
