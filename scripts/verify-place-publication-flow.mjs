import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/place-publishing.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const module = { exports: {} };
vm.runInNewContext(compiled, { exports: module.exports, module });

const { normalizePlacePublicationForWrite, isPublicPlace } = module.exports;

const newPlace = normalizePlacePublicationForWrite({
  slug: "jinsong-suyeong",
  name_ko: "진송숯불 수영점",
  latitude: 35.1671242,
  longitude: 129.1170388,
});

assert.equal(newPlace.is_active, true);
assert.equal(newPlace.status, "ACTIVE");
assert.equal(newPlace.latitude, 35.1671242);
assert.equal(newPlace.longitude, 129.1170388);
assert.equal(isPublicPlace(newPlace), true);

const staleArchivedPayload = normalizePlacePublicationForWrite({
  is_active: true,
  status: "ARCHIVED",
  latitude: 35.1671242,
  longitude: 129.1170388,
});

assert.equal(staleArchivedPayload.is_active, true);
assert.equal(staleArchivedPayload.status, "ACTIVE");
assert.equal(isPublicPlace(staleArchivedPayload), true);

const draftPayload = normalizePlacePublicationForWrite({
  is_active: false,
  status: "ARCHIVED",
  latitude: 35.1671242,
  longitude: 129.1170388,
});

assert.equal(draftPayload.is_active, false);
assert.equal(draftPayload.status, "DRAFT");
assert.equal(isPublicPlace(draftPayload), false);

const nearbyEligible =
  isPublicPlace(newPlace) &&
  typeof newPlace.latitude === "number" &&
  typeof newPlace.longitude === "number";

assert.equal(nearbyEligible, true);

const migration = fs.readFileSync("supabase/migrations/012_place_publication_defaults.sql", "utf8");
assert.match(migration, /alter column is_active set default true/i);
assert.match(migration, /alter column status set default 'ACTIVE'/i);
