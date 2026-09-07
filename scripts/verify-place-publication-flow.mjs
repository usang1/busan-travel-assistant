import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTsExports(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;

  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module });
  return module.exports;
}

const {
  normalizePlacePublicationForWrite,
  normalizePlaceStatusForWrite,
  isPublicPlace,
  nextPlacePublicationStatus,
  publicReadablePlaceStatuses,
} = loadTsExports("lib/place-publishing.ts");

const newPlace = normalizePlacePublicationForWrite({
  slug: "jinsong-suyeong",
  name_ko: "진송숯불 수영점",
  latitude: 35.1671242,
  longitude: 129.1170388,
});

assert.equal(newPlace.is_active, false);
assert.equal(newPlace.status, "DRAFT");
assert.equal(isPublicPlace(newPlace), false);

const publishCandidate = normalizePlacePublicationForWrite({
  ...newPlace,
  is_active: true,
  status: "PUBLISHED",
});

assert.equal(publishCandidate.is_active, true);
assert.equal(publishCandidate.status, "PUBLISHED");
assert.equal(isPublicPlace(publishCandidate), true);

const legacyActive = { is_active: true, status: "ACTIVE" };
assert.equal(isPublicPlace(legacyActive), true);
assert.equal(normalizePlaceStatusForWrite(legacyActive), "PUBLISHED");

const staleArchivedPayload = normalizePlacePublicationForWrite({
  is_active: true,
  status: "ARCHIVED",
  latitude: 35.1671242,
  longitude: 129.1170388,
});

assert.equal(staleArchivedPayload.is_active, false);
assert.equal(staleArchivedPayload.status, "ARCHIVED");
assert.equal(isPublicPlace(staleArchivedPayload), false);

const draftPayload = normalizePlacePublicationForWrite({
  is_active: false,
  status: "INACTIVE",
  latitude: 35.1671242,
  longitude: 129.1170388,
});

assert.equal(draftPayload.is_active, false);
assert.equal(draftPayload.status, "DRAFT");
assert.equal(isPublicPlace(draftPayload), false);
assert.equal(nextPlacePublicationStatus(draftPayload), "PUBLISHED");
assert.deepEqual([...publicReadablePlaceStatuses], ["PUBLISHED", "ACTIVE"]);

const nearbyEligible =
  isPublicPlace(publishCandidate) &&
  typeof publishCandidate.latitude === "number" &&
  typeof publishCandidate.longitude === "number";

assert.equal(nearbyEligible, true);

const migration = fs.readFileSync("supabase/migrations/020_place_quality_workflow.sql", "utf8");
assert.match(migration, /add column if not exists closed_days/i);
assert.match(migration, /add column if not exists last_verified_at/i);
assert.match(migration, /add column if not exists chinese_service/i);
assert.match(migration, /alter column is_active set default false/i);
assert.match(migration, /alter column status set default 'DRAFT'/i);
assert.match(migration, /status in \('PUBLISHED', 'ACTIVE'\)/i);
assert.match(migration, /create or replace function public\.get_place_rankings/i);
assert.match(migration, /create or replace function public\.set_place_saved/i);
assert.match(migration, /notify pgrst, 'reload schema'/i);

const approvalRoute = fs.readFileSync("app/api/admin/submissions/[id]/approve/route.ts", "utf8");
assert.match(approvalRoute, /createPlace\(payload, client\)/);
assert.doesNotMatch(approvalRoute, /is_active:\s*true/);
assert.doesNotMatch(approvalRoute, /status:\s*["']ACTIVE["']/);

const adminManager = fs.readFileSync("components/AdminPlaceManager.tsx", "utf8");
assert.match(adminManager, /PlaceQualityPanel/);
assert.match(adminManager, /MobilePlacePreview/);
assert.match(adminManager, /qualityFilterOptions/);
assert.doesNotMatch(adminManager, /defaultImage/);
