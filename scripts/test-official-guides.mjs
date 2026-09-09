import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function load(request, mocks = {}) {
  if (request in mocks) return mocks[request];
  const filename = path.resolve(request.replace(/^@\//, "") + ".ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (request) => load(request, mocks), URL, Date, Response, Request }, { filename });
  return module.exports;
}
const { validateGuidePayload, emptyGuideText } = load("@/lib/guide-validation");
const base = {
  slug: "gwangalli-day", status: "DRAFT", guide_type: "ITINERARY", title_ko: "검증용 코스",
  weather_type: "ANY", sort_order: 0, is_featured: false, places: [],
};
assert.equal(validateGuidePayload(base).title_ko, base.title_ko);
assert.throws(() => validateGuidePayload({ ...base, status: "PUBLISHED" }));
assert.throws(() => validateGuidePayload({ ...base, slug: "../../admin" }));
assert.throws(() => validateGuidePayload({ ...base, cover_image: "javascript:alert(1)" }));
assert.throws(() => validateGuidePayload({ ...base, estimated_duration: -1 }));
assert.throws(() => validateGuidePayload({ ...base, guide_type: "PERSONAL" }));
assert.throws(() => validateGuidePayload({ ...base, recommended_for: [] }));
const first = { place_id: "11111111-1111-4111-8111-111111111111", sequence: 9, custom_title: emptyGuideText(), stay_minutes: 20 };
const second = { ...first, place_id: "22222222-2222-4222-8222-222222222222", sequence: 4 };
assert.throws(() => validateGuidePayload({ ...base, places: [first, first] }));
assert.throws(() => validateGuidePayload({ ...base, places: [{ ...first, stay_minutes: 1.5 }] }));
assert.throws(() => validateGuidePayload({ ...base, places: Array(81).fill(first) }));
const reordered = validateGuidePayload({ ...base, places: [second, first], id: "untrusted", created_at: "untrusted" });
assert.equal(reordered.places[0].place_id, second.place_id);
assert.equal(reordered.places[0].sequence, 0);
assert.equal(reordered.places[1].sequence, 1);
assert.equal(reordered.id, undefined);
const published = { ...base, status: "PUBLISHED", ...Object.fromEntries(["ko", "zh", "en", "ja"].flatMap((locale) => [[`title_${locale}`, locale], [`description_${locale}`, `Description ${locale}`]])) };
assert.equal(validateGuidePayload(published).status, "PUBLISHED");

// Exercise every handler with authorization failures, verifying no DB mutation is reached.
for (const status of [401, 403]) {
  let calls = 0;
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/admin-auth": {
      requireAdmin: async () => { calls++; throw Object.assign(new Error("Denied"), { status }); },
      adminErrorResponse: (error) => ({ message: error.message, status: error.status }),
    },
    "@/lib/guide-admin": { saveOfficialGuide: () => { throw new Error("Authorization bypass"); } },
  };
  const collection = load("@/app/api/admin/guides/route", mocks);
  const detail = load("@/app/api/admin/guides/[id]/route", mocks);
  for (const handler of [collection.GET, collection.POST, detail.GET, detail.PUT, detail.DELETE]) {
    const response = await handler(new Request("http://localhost/api/admin/guides"), { params: Promise.resolve({ id: first.place_id }) });
    assert.equal(response.status, status);
  }
  assert.equal(calls, 5);
}
process.stdout.write("Official guide validation, ordering, localization requirements and API authorization tests passed.\n");
