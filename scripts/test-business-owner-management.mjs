import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, modules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => {
    if (name in modules) return modules[name];
    throw new Error(`Unexpected import: ${name}`);
  });
  return module.exports;
}

const payloadModule = compile("../lib/business-place-payload.ts", {
  "@/lib/place-validation": { validatePlacePayloadForSave: () => {}, validatePlaceReadyForPublication: () => {} },
});
const unsafe = {
  id: "forged", status: "PUBLISHED", is_active: true, is_featured: true, admin_summary: "forged",
  last_verified_at: "2026-01-01", verification_tier: 3, verification_checked_by: "forged",
  decision_profile: { tourist_fit_score: 5 },
  source: { provider: "NAVER", source_url: "https://map.naver.com/test", raw_metadata: { rating: 5 }, last_synced_at: "now" },
  gallery_images: [{ url: "https://example.com/gallery.webp", kind: "interior" }],
  menu_items: [{ id: "other-menu", place_id: "other-place", name_ko: "메뉴1", image_url: "https://example.com/menu.webp" }, { name_ko: "메뉴2" }, { name_ko: "메뉴3" }],
  china_info: { chinese_menu: "yes", verification_status: "verified", verification_basis: "admin", verified_at: "now", manual_summary_override: "forged" },
};
const safe = payloadModule.sanitizeBusinessPlacePayload(unsafe);
for (const key of ["id", "status", "is_active", "is_featured", "admin_summary", "last_verified_at", "verification_tier", "verification_checked_by", "decision_profile"]) assert.equal(key in safe, false, `owner payload must strip ${key}`);
assert.equal("raw_metadata" in safe.source, false);
assert.equal("last_synced_at" in safe.source, false);
assert.equal(safe.menu_items.length, 3, "three or more menus must survive sanitization");
assert.equal("id" in safe.menu_items[0], false, "owner menu ids must not target another place's rows");
assert.equal(safe.menu_items[0].image_url, "https://example.com/menu.webp");
assert.equal(safe.gallery_images.length, 1, "gallery images must survive the owner review snapshot");
for (const key of ["verification_status", "verification_basis", "verified_at", "manual_summary_override"]) assert.equal(key in safe.china_info, false, `owner China payload must strip ${key}`);
assert.equal(safe.china_info.chinese_menu, "yes");

const migration = readFileSync(new URL("../supabase/migrations/047_business_owner_management.sql", import.meta.url), "utf8");
for (const table of ["business_place_memberships", "business_place_changes", "business_place_change_audit"]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
}
for (const fn of ["review_business_application", "save_business_place_change", "approve_business_place_change", "review_business_place_change"]) assert.match(migration, new RegExp(`function public\\.${fn}`));
for (const state of ["draft", "pending_review", "changes_requested", "rejected", "approved"]) assert.match(migration, new RegExp(`'${state}'`));
assert.match(migration, /for update/, "application approval must lock the application row");
assert.match(migration, /on conflict \(place_id, user_id\) do update/, "approval must be idempotent for ownership");
assert.match(migration, /set role = 'business_owner'/, "approval must grant the existing owner role");
assert.match(migration, /application_row\.status = 'approved'/, "duplicate approvals must have an idempotent branch");
assert.match(migration, /Authenticated users create own business applications/, "ordinary signed-in users must be allowed to apply");
assert.match(migration, /prevent_unprivileged_profile_role_change/, "users must not self-promote their role");
assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/, "storage writes must stay in the owner's folder");
assert.match(migration, /Owners read managed place menus/, "owners must be able to reload menus for an inactive managed place");
assert.match(migration, /perform public\.replace_place_menu_items/, "menu publication must be inside the approval transaction");
assert.match(migration, /add column if not exists gallery_images/);
assert.match(migration, /add column if not exists image_url/);
assert.match(migration, /delete from public\.place_translations[\s\S]*delete from public\.place_tags/, "translations and tags must publish in the same approval transaction");
assert.match(migration, /set status = 'PUBLISHED', is_active = true/, "only final place-information approval may publish a place");
assert.match(migration, /if change_row\.status = 'approved'[\s\S]*already_approved/, "duplicate approvals must be idempotent");
assert.match(migration, /where id = change_id for update/, "concurrent approvals must serialize on the submitted row");
assert.match(migration, /business_place_changes_audit/, "review history must be preserved");

const response = { json: (body, init = {}) => ({ status: init.status ?? 200, body }) };
const applicationId = "11111111-1111-4111-8111-111111111111";
let rpcResult = { ok: true, code: "updated" };
let rpcInput;
const client = { rpc: async (name, input) => { rpcInput = { name, input }; return { data: rpcResult, error: null }; } };
const route = compile("../app/api/admin/business-applications/[id]/route.ts", {
  "next/server": { NextResponse: response },
  "@/lib/admin-auth": { requireAdmin: async () => ({ client }) },
  "@/lib/business-auth": { isUuid: (value) => /^[0-9a-f-]{36}$/i.test(value) },
});
const request = (body) => ({ json: async () => body });
let result = await route.PATCH(request({ status: "approved", linked_place_id: null }), { params: Promise.resolve({ id: applicationId }) });
assert.equal(result.status, 200);
assert.equal(rpcInput.name, "review_business_application");
assert.equal(rpcInput.input.application_id, applicationId);
assert.equal(rpcInput.input.next_status, "approved");
rpcResult = { ok: false, code: "applicant_profile_missing" };
result = await route.PATCH(request({ status: "approved" }), { params: Promise.resolve({ id: applicationId }) });
assert.equal(result.status, 409);
assert.match(result.body.message, /신청자 계정/);
rpcResult = { ok: true, code: "already_approved" };
result = await route.PATCH(request({ status: "approved" }), { params: Promise.resolve({ id: applicationId }) });
assert.equal(result.status, 200);
assert.match(result.body.message, /이미 승인/);
assert.equal((await route.PATCH(request({ status: "approved", linked_place_id: "forged" }), { params: Promise.resolve({ id: applicationId }) })).status, 400);
assert.equal((await route.PATCH(request({ status: "not-a-status" }), { params: Promise.resolve({ id: applicationId }) })).status, 400);

const manager = readFileSync(new URL("../components/AdminPlaceManager.tsx", import.meta.url), "utf8");
assert.match(manager, /mode\?: "admin" \| "business"/, "admin and owners must reuse the same place editor component");
assert.match(manager, /businessMode[\s\S]*\/api\/business\/place-changes/, "the shared editor must route owner saves into review snapshots");
assert.match(manager, /initialBusinessForm/, "owner drafts must be restored after refresh");
assert.match(manager, /businessMode \? "검수 요청"/, "owners must explicitly submit review requests");
assert.match(manager, /businessMode \? "\/api\/business\/place-image"/, "owner image uploads must use the ownership-aware route");
assert.match(manager, /<PlaceMenuEditor/, "the same editor must retain multi-menu CRUD");

const changeRoute = readFileSync(new URL("../app/api/business/place-changes/route.ts", import.meta.url), "utf8");
assert.match(changeRoute, /sanitizeBusinessPlacePayload/);
assert.match(changeRoute, /validateBusinessPlaceSubmission/);
assert.match(changeRoute, /save_business_place_change/);
const reviewRoute = readFileSync(new URL("../app/api/admin/business-place-changes/[id]/route.ts", import.meta.url), "utf8");
assert.match(reviewRoute, /approve_business_place_change/);
assert.match(reviewRoute, /review_business_place_change/);
assert.doesNotMatch(reviewRoute, /createPlace|updatePlace/, "publication must not be split across application-layer writes");
assert.match(reviewRoute, /changes_requested/, "administrators must be able to request changes separately from rejection");

const dashboard = readFileSync(new URL("../components/BusinessDashboard.tsx", import.meta.url), "utf8");
assert.match(dashboard, /status === "rejected"[\s\S]*admin_notes/, "rejected applications must show the reason");
assert.match(dashboard, /<AdminPlaceManager[\s\S]*mode="business"/, "approved owners must receive the shared editor");
assert.match(dashboard, /최종 승인 후에만 사용자 사이트에 반영됩니다/, "owners must be told that drafts are not public");
assert.match(dashboard, /pending_review/, "pending submissions must be locked in the owner dashboard");

const publicStore = readFileSync(new URL("../lib/place-store.ts", import.meta.url), "utf8");
assert.match(publicStore, /query = query\.eq\("is_active", true\)/);
assert.match(publicStore, /query = query\.in\("status", publicStatusFilters\)/);
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
assert.match(sitemap, /getPlaces\(\{ activeOnly: true/, "sitemap must exclude unapproved places at the server query layer");

console.log("Business owner management tests passed: application approval, ownership, RLS, review snapshots, field filtering, multi-menu and shared editor contracts.");
