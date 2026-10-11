import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const manager = readFileSync("components/AdminPlaceManager.tsx", "utf8");
const workflow = readFileSync("components/AdminSubmissionWorkflow.tsx", "utf8");
const store = readFileSync("lib/place-store.ts", "utf8");
const migration = readFileSync("supabase/migrations/042_atomic_place_menu_replace.sql", "utf8");
const priceLevels = readFileSync("lib/price-level.ts", "utf8");
const reviewMigration = readFileSync("supabase/migrations/043_place_review_quality_and_visit_photos.sql", "utf8");
const accountMigration = readFileSync("supabase/migrations/044_account_roles_and_business_applications.sql", "utf8");
const businessRoute = readFileSync("app/api/business-applications/route.ts", "utf8");
const businessForm = readFileSync("components/BusinessApplicationForm.tsx", "utf8");
const adminAuth = readFileSync("lib/admin-auth.ts", "utf8");
const onboardingRoute = readFileSync("app/api/profile/onboarding/route.ts", "utf8");
const adminOwnerMigration = readFileSync("supabase/migrations/045_admin_business_owner_capabilities.sql", "utf8");
const header = readFileSync("components/Header.tsx", "utf8");
const i18n = readFileSync("lib/i18n.ts", "utf8");
const submissionTypeNavigation = readFileSync("components/SubmissionTypeNavigation.tsx", "utf8");
const localizedContactPage = readFileSync("app/[locale]/contact/page.tsx", "utf8");
const localizedBusinessPage = readFileSync("app/[locale]/business-application/page.tsx", "utf8");

assert.doesNotMatch(manager, /key=\{`\$\{index\}-\$\{item\.name_ko\}`\}/);
assert.doesNotMatch(workflow, /key=\{`\$\{item\.name_ko\}-\$\{index\}`\}/);
assert.match(manager, /key=\{item\.id \?\? item\.client_key\}/);
assert.match(workflow, /key=\{item\.id \?\? item\.client_key\}/);

assert.match(store, /rpc\("replace_place_menu_items"/);
assert.ok(store.indexOf('runPlaceSaveStage("메뉴"') < store.indexOf('from("places").update'));
assert.match(migration, /delete from public\.place_menu_items/);
assert.match(migration, /insert into public\.place_menu_items/);
assert.match(migration, /if not public\.is_admin\(\)/);
assert.doesNotMatch(priceLevels, /"\\"/);
assert.match(priceLevels, /원화 1단계 \(₩\)/);
assert.match(reviewMigration, /place_verification_history/);
assert.match(reviewMigration, /direct_visit_photos/);
assert.match(reviewMigration, /purpose_dependent/);
assert.match(accountMigration, /business_owner/);
assert.match(accountMigration, /public\.is_admin\(\)/);
assert.match(accountMigration, /business_applications_active_duplicate_uidx/);
assert.match(businessRoute, /hasBusinessOwnerAccess\(profile\.role\)/);
assert.match(businessForm, /hasBusinessOwnerAccess\(profile\?\.role\)/);
assert.match(adminAuth, /hasAdminAccess\(profile\.role\)/);
assert.doesNotMatch(adminAuth, /hasBusinessOwnerAccess/);
assert.match(businessRoute, /sendBusinessApplicationNotification/);
assert.match(onboardingRoute, /hasAdminAccess\(currentProfile\.role\) \? "admin" : requestedRole/);
assert.match(adminOwnerMigration, /role in \('business_owner', 'admin'\)/);
assert.match(adminOwnerMigration, /public\.has_business_owner_access\(\)/);
assert.match(header, /href=\{withLocale\("\/business-application", currentLocale\)\}/);
assert.match(header, /copy\.nav\.businessApplication/);
assert.doesNotMatch(header, /profile\?\.role === "business_owner"[\s\S]{0,300}business-application/);
assert.doesNotMatch(header, /href=\{withLocale\("\/business-application", currentLocale\)\}[\s\S]{0,180}className="hidden/);
for (const label of ["商家入驻", "List my business", "店舗掲載申請", "가게 입점 신청"]) {
  assert.match(i18n, new RegExp(label));
}
assert.match(submissionTypeNavigation, /href: "\/contact"/);
assert.match(submissionTypeNavigation, /href: "\/business-application"/);
assert.match(submissionTypeNavigation, /grid grid-cols-2/);
assert.doesNotMatch(submissionTypeNavigation, /className="[^"]*\bhidden\b/);
assert.match(localizedContactPage, /SubmissionTypeNavigation active="place" locale=\{locale\}/);
assert.match(localizedBusinessPage, /SubmissionTypeNavigation active="business" locale=\{locale\}/);

const dateSource = readFileSync("lib/date-input.ts", "utf8");
const dateOutput = ts.transpileModule(dateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dateModule = { exports: {} };
new Function("module", "exports", dateOutput)(dateModule, dateModule.exports);
assert.equal(dateModule.exports.toDateInputValue("2026-10-11T23:59:59+09:00"), "2026-10-11");
assert.equal(dateModule.exports.toDateInputValue("2026-02-30"), "");
assert.equal(dateModule.exports.fromDateInputValue(""), null);
assert.equal(dateModule.exports.fromDateInputValue("2026-10-11"), "2026-10-11");

const roleSource = readFileSync("lib/account-role.ts", "utf8");
const roleOutput = ts.transpileModule(roleSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const roleModule = { exports: {} };
new Function("module", "exports", roleOutput)(roleModule, roleModule.exports);
assert.equal(roleModule.exports.hasBusinessOwnerAccess("business_owner"), true);
assert.equal(roleModule.exports.hasBusinessOwnerAccess("admin"), true);
assert.equal(roleModule.exports.hasBusinessOwnerAccess("tourist"), false);
assert.equal(roleModule.exports.hasAdminAccess("business_owner"), false);
assert.equal(roleModule.exports.hasAdminAccess("admin"), true);

console.log("Admin place core regression checks passed (stable menu keys, atomic menu RPC ordering, KRW labels, and responsive business application entry/switcher). ");
