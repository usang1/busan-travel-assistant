import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(file, modules = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected import: ${name}`);
  });
  return module.exports;
}

const { getSafeNextPath } = compile("lib/auth-flow.ts");
const fallback = "/en/saved";
for (const value of [null, "", "https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/\n/evil.invalid", "/\t/evil.invalid", "/\r/evil.invalid", "/a/..//evil.invalid", "javascript:alert(1)"]) {
  assert.equal(getSafeNextPath(value, fallback), fallback, `Reject unsafe return path ${JSON.stringify(value)}`);
}
for (const value of ["/en/places?city=busan&search=cafe#results", "/zh/business-application", "/ko/onboarding?next=%2Fko%2Fsaved", "/ja/places/%E3%82%AB%E3%83%95%E3%82%A7"]) {
  assert.equal(getSafeNextPath(value, fallback), value);
}

let writes = [];
let role = "tourist";
const query = {
  select: () => query,
  eq: () => query,
  maybeSingle: async () => ({ data: { role }, error: null }),
  update: (value) => { writes.push(value); return { eq: async () => ({ error: null }) }; },
};
const { POST } = compile("app/api/profile/onboarding/route.ts", {
  "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
  "@/lib/account-role": { hasAdminAccess: (value) => value === "admin" },
  "@/lib/server-supabase": { createServerAnonClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) }, from: () => query }) },
});
const valid = { displayName: "Tester", role: "tourist", terms: true, privacy: true, marketing: false };
const request = (body, authorization = "Bearer test-token") => new Request("http://localhost/api/profile/onboarding", { method: "POST", headers: { ...(authorization ? { authorization } : {}), "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
for (const authorization of ["", "test-token", "Basic test-token"]) assert.equal((await POST(request(valid, authorization))).status, 401);
for (const body of [null, [], "{", { ...valid, displayName: 42 }, { ...valid, displayName: " " }, { ...valid, displayName: "a".repeat(81) }, { ...valid, terms: "false" }, { ...valid, privacy: 1 }, { ...valid, role: "admin" }]) {
  assert.equal((await POST(request(body))).status, 400);
}
assert.equal(writes.length, 0, "Invalid requests must not write to profiles");
for (const existingRole of ["tourist", "business_owner", "admin"]) {
  role = existingRole;
  assert.equal((await POST(request({ ...valid, role: "business_owner" }))).status, 200);
  assert.equal(writes.at(-1).role, existingRole, "Onboarding must preserve approved permissions");
}
console.log("Auth safety passed: return URL bypasses, malformed onboarding, strict consent, and role preservation.");

// Exercise the server authorization boundary with a verified-user response;
// client session/profile state must never determine administrator access.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://audit.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-public-key";
let verifiedUser = { id: "verified-user" };
let verifiedRole = "tourist";
const roleQuery = { select: () => roleQuery, eq: () => roleQuery, maybeSingle: async () => ({ data: { role: verifiedRole }, error: null }) };
const { requireAdmin } = compile("lib/admin-auth.ts", {
  "@supabase/supabase-js": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: verifiedUser }, error: null }) }, from: () => roleQuery }) },
  "@/lib/account-role": { hasAdminAccess: (value) => value === "admin" },
});
const authRequest = (authorization) => new Request("https://audit.invalid/api/admin/me", { headers: authorization ? { authorization } : {} });
await assert.rejects(requireAdmin(authRequest()), (error) => error.status === 401);
for (const value of ["tourist", "business_owner"]) {
  verifiedRole = value;
  await assert.rejects(requireAdmin(authRequest("Bearer test")), (error) => error.status === 403);
}
verifiedRole = "admin";
assert.equal((await requireAdmin(authRequest("Bearer test"))).user.id, "verified-user");
verifiedUser = null;
await assert.rejects(requireAdmin(authRequest("Bearer test")), (error) => error.status === 401);
console.log("Server admin authorization passed: anonymous/expired sessions rejected, tourist/owner forbidden, verified admin accepted.");
