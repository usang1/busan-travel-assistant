import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const migration = await readFile(new URL("../supabase/migrations/053_place_field_verification_system.sql", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/admin/places/[id]/verifications/route.ts", import.meta.url), "utf8");
const importApi = await readFile(new URL("../app/api/admin/place-imports/route.ts", import.meta.url), "utf8");
const publicView = await readFile(new URL("../components/PlaceFieldVerificationSummary.tsx", import.meta.url), "utf8");
const csvSource = await readFile(new URL("../lib/csv.ts", import.meta.url), "utf8");
const csvJavaScript = ts.transpileModule(csvSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseCsv, toCsv } = await import(`data:text/javascript;base64,${Buffer.from(csvJavaScript).toString("base64")}`);

for (const table of ["place_field_verifications", "place_data_sources", "place_verification_visits", "place_verification_photos", "place_change_history", "place_import_batches", "place_import_rows"]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} must be additive`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must have RLS`);
}
for (const status of ["unverified", "auto_imported", "online_verified", "owner_confirmed", "field_verified", "needs_recheck"]) assert.match(migration, new RegExp(status));
assert.match(migration, /actual_field_visit_required/);
assert.match(migration, /verification_status in \('online_verified', 'field_verified'\)[\s\S]*current_value is distinct from excluded\.current_value/);
assert.match(migration, /conflicting_value/);
assert.match(migration, /approval_status = 'approved'[\s\S]*is_public = true/);
assert.match(migration, /make_interval\(days => rule\.stale_after_days\)/);
assert.match(api, /actual_visit/);
assert.match(api, /online_verified[\s\S]*출처 URL/);
assert.match(importApi, /status: "DRAFT", is_active: false/);
assert.match(importApi, /action === "merge"[\s\S]*attachProposal/);
assert.doesNotMatch(importApi, /status: "PUBLISHED"/);
assert.match(publicView, /rows\.length/);
assert.match(publicView, /verificationStatusLabel/);

const csv = `가게명,주소,메모\n"쉼표, 식당","부산, 수영구","따옴표 ""확인"""\n둘째,부산 해운대구,정상`;
const parsed = parseCsv(csv);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0]["가게명"], "쉼표, 식당");
assert.equal(parsed.rows[0]["메모"], '따옴표 "확인"');
assert.throws(() => parseCsv('name\n"broken'), /따옴표/);
assert.throws(() => parseCsv(`name\n${Array.from({ length: 1001 }, (_, index) => index).join("\n")}`), /최대 1000행/);
const exported = toCsv(["name", "note"], [{ name: "A,B", note: 'say "hi"' }]);
assert.match(exported, /^\uFEFFname,note/);
assert.match(exported, /"A,B","say ""hi"""/);

console.log("Place verification system tests passed: provenance, field states, field-visit evidence, public boundary, CSV parsing, duplicate proposal safety.");
