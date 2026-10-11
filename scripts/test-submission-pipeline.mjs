import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function compile(path, modules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, (name) => modules[name] ?? requireMissing(name));
  return module.exports;
}

function requireMissing(name) {
  if (name === "node:crypto") return { randomUUID: () => "test-approval-token", createHash: () => ({ update: () => ({ digest: () => "a".repeat(64) }) }) };
  throw new Error(`Unexpected import: ${name}`);
}

const workflow = compile("../lib/submission-workflow.ts");
assert.equal(workflow.canChangeSubmissionStatus("pending", "approved"), false);
assert.equal(workflow.canChangeSubmissionStatus("approved", "rejected"), false);
assert.equal(workflow.canChangeSubmissionStatus("pending", "reviewing"), true);
assert.equal(workflow.canChangeSubmissionStatus("reviewing", "rejected"), true);
assert.equal(workflow.canChangeSubmissionStatus("rejected", "reviewing"), true);
assert.equal(workflow.canApproveSubmission("rejected"), false);
assert.equal(workflow.canApproveSubmission("reviewing"), true);

const response = { json: (body, options = {}) => ({ status: options.status ?? 200, body }) };
const submissionId = "11111111-1111-4111-8111-111111111111";
let row;
let placeWrites = 0;
let archiveWrites = 0;
let placeFailure = false;
let finalizeFailure = false;
let createDelay = 0;

function resetRow(status = "pending") {
  row = { id: submissionId, status, place_id: null, approval_token: null, approval_started_at: null, approval_last_error: null };
  placeWrites = 0;
  archiveWrites = 0;
  placeFailure = false;
  finalizeFailure = false;
  createDelay = 0;
}

class Query {
  constructor(table) { this.table = table; this.filters = []; this.patch = null; }
  select() { return this; }
  update(value) { this.patch = value; return this; }
  eq(key, value) { this.filters.push((item) => item[key] === value); return this; }
  is(key, value) { this.filters.push((item) => item[key] === value); return this; }
  in(key, values) { this.filters.push((item) => values.includes(item[key])); return this; }
  then(onFulfilled, onRejected) { return this.maybeSingle().then(onFulfilled, onRejected); }
  async single() { const result = await this.maybeSingle(); return result.data ? result : { data: null, error: { message: "not found" } }; }
  async maybeSingle() {
    assert.equal(this.table, "place_submissions");
    if (!row || !this.filters.every((filter) => filter(row))) return { data: null, error: null };
    if (this.patch) {
      if (finalizeFailure && this.patch.status === "approved") return { data: null, error: { message: "injected finalization failure" } };
      Object.assign(row, this.patch);
    }
    return { data: { ...row }, error: null };
  }
}

const client = { from: (table) => new Query(table) };
const adminAuth = { requireAdmin: async () => ({ client, user: { id: "admin-1" } }), adminErrorResponse: (error) => ({ status: error.status ?? 500, message: error.message }) };
const store = {
  findExistingPlaceIdForApproval: async () => null,
  createPlace: async () => {
    placeWrites += 1;
    if (createDelay) await new Promise((resolve) => setTimeout(resolve, createDelay));
    if (placeFailure) throw new Error("injected place failure");
    return { id: `place-${placeWrites}` };
  },
  updatePlace: async () => { placeWrites += 1; return { id: "existing-place" }; },
  archivePlace: async () => { archiveWrites += 1; },
};
const sharedMocks = {
  "next/server": { NextResponse: response },
  "next/cache": { revalidateTag: () => {} },
  "@/lib/admin-auth": adminAuth,
  "@/lib/cache-tags": { publicPlacesCacheTag: "public-places" },
  "@/lib/place-store": store,
  "@/lib/place-validation": { validatePlaceReadyForPublication: () => {} },
  "@/lib/submission-workflow": workflow,
};
const reviewRoute = compile("../app/api/admin/submissions/[id]/route.ts", sharedMocks);
const approvalRoute = compile("../app/api/admin/submissions/[id]/approve/route.ts", sharedMocks);
const deniedAuth = { ...adminAuth, requireAdmin: async () => { throw Object.assign(new Error("forbidden"), { status: 403 }); } };
const deniedReviewRoute = compile("../app/api/admin/submissions/[id]/route.ts", { ...sharedMocks, "@/lib/admin-auth": deniedAuth });
const deniedApprovalRoute = compile("../app/api/admin/submissions/[id]/approve/route.ts", { ...sharedMocks, "@/lib/admin-auth": deniedAuth });
const deniedAuditRoute = compile("../app/api/admin/submissions/[id]/audit/route.ts", { "next/server": { NextResponse: response }, "@/lib/admin-auth": deniedAuth });
const deniedNotificationRoute = compile("../app/api/admin/submissions/[id]/notification/route.ts", { "next/server": { NextResponse: response }, "@/lib/admin-auth": deniedAuth, "@/lib/submission-notifications": {} });
const context = { params: Promise.resolve({ id: submissionId }) };
const payload = { status: "PUBLISHED", is_active: true, slug: "audit-test-place" };
const request = (body) => ({ json: async () => body });
assert.equal((await deniedReviewRoute.PATCH(request({ status: "reviewing" }), context)).status, 403);
assert.equal((await deniedApprovalRoute.POST(request(payload), context)).status, 403);
assert.equal((await deniedAuditRoute.GET(request({}), context)).status, 403);
assert.equal((await deniedNotificationRoute.POST(request({}), context)).status, 403);

resetRow();
assert.equal((await reviewRoute.PATCH(request({ status: "approved" }), context)).status, 400);
assert.equal((await reviewRoute.PATCH(request({ status: "rejected" }), context)).status, 200);
assert.equal(row.status, "rejected");
assert.equal((await approvalRoute.POST(request(payload), context)).status, 409);
assert.equal(placeWrites, 0);
assert.equal((await reviewRoute.PATCH(request({ status: "reviewing" }), context)).status, 200);
assert.equal((await approvalRoute.POST(request({ ...payload, status: "DRAFT", is_active: false }), context)).status, 400);
assert.equal((await approvalRoute.POST(request(payload), context)).status, 200);
assert.equal(row.status, "approved");
assert.equal(row.place_id, "place-1");
assert.equal(placeWrites, 1);
assert.equal((await approvalRoute.POST(request(payload), context)).status, 409);
assert.equal((await reviewRoute.PATCH(request({ status: "rejected" }), context)).status, 409);
assert.equal(placeWrites, 1);

resetRow();
createDelay = 25;
const concurrent = await Promise.all([approvalRoute.POST(request(payload), context), approvalRoute.POST(request(payload), context)]);
assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 409]);
assert.equal(placeWrites, 1);

resetRow();
placeFailure = true;
assert.equal((await approvalRoute.POST(request(payload), context)).status, 500);
assert.equal(row.status, "pending");
assert.equal(row.approval_token, null);
assert.equal(row.approval_last_error, "place_write_failed");

resetRow();
finalizeFailure = true;
assert.equal((await approvalRoute.POST(request(payload), context)).status, 500);
assert.equal(row.status, "pending");
assert.equal(row.approval_token, null);
assert.equal(row.approval_last_error, "submission_finalize_failed");
assert.equal(archiveWrites, 1);

let telegramOk = false;
let telegramThrows = false;
const notification = compile("../lib/submission-notifications.ts", {
  "server-only": {},
  "@/lib/telegram": { sendPlaceSubmissionNotification: async () => { if (telegramThrows) throw new Error("injected send failure"); return { ok: telegramOk, skipped: false }; } },
});
resetRow();
let sent = await notification.notifyPlaceSubmission({ submissionId, submitterLabel: "test", client, previousAttempts: 0 });
assert.deepEqual(sent, { status: "failed", recorded: true });
assert.equal(row.notification_status, "failed");
assert.equal(row.notification_attempts, 1);
telegramOk = true;
sent = await notification.notifyPlaceSubmission({ submissionId, submitterLabel: "test", client, previousAttempts: 1 });
assert.deepEqual(sent, { status: "sent", recorded: true });
assert.equal(row.notification_status, "sent");
assert.equal(row.notification_attempts, 2);
telegramThrows = true;
assert.deepEqual(await notification.notifyPlaceSubmission({ submissionId, submitterLabel: "test", client, previousAttempts: 2 }), { status: "failed", recorded: true });
telegramThrows = false;
assert.deepEqual(await notification.notifyPlaceSubmission({ submissionId, submitterLabel: "test", client: { from: () => { throw new Error("injected write failure"); } }, previousAttempts: 3 }), { status: "sent", recorded: false });
const missingRowClient = { from: () => new Query("place_submissions") };
row = null;
assert.deepEqual(await notification.notifyPlaceSubmission({ submissionId, submitterLabel: "test", client: missingRowClient, previousAttempts: 3 }), { status: "sent", recorded: false });

const telegram = compile("../lib/telegram.ts", {
  "server-only": {},
  "@/config/site": { absoluteUrl: (path) => `https://example.test${path}` },
});
const originalFetch = globalThis.fetch;
const originalBotToken = process.env.TELEGRAM_BOT_TOKEN;
const originalChatId = process.env.TELEGRAM_CHAT_ID;
let telegramRequest;
try {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "test-chat";
  globalThis.fetch = async (url, init) => {
    telegramRequest = { url, body: JSON.parse(init.body) };
    return Response.json({ ok: true });
  };
  assert.equal((await telegram.sendPlaceSubmissionNotification({ submitterLabel: "test", submissionId })).ok, true);
  assert.equal(telegramRequest.body.chat_id, "test-chat");
  assert.match(telegramRequest.body.text, /submission=11111111-1111-4111-8111-111111111111/);
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal((await telegram.sendPlaceSubmissionNotification({ submitterLabel: "test" })).skipped, true);
} finally {
  globalThis.fetch = originalFetch;
  if (originalBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = originalBotToken;
  if (originalChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
  else process.env.TELEGRAM_CHAT_ID = originalChatId;
}

const migration = readFileSync(new URL("../supabase/migrations/039_submission_pipeline_operability.sql", import.meta.url), "utf8");
assert.match(migration, /status = 'pending'[\s\S]*place_id is null[\s\S]*reviewed_by is null/);
assert.match(migration, /drop policy if exists "Users can update own draft place submissions"/);
assert.match(migration, /create table if not exists public\.place_submission_audit/);
assert.match(migration, /using \(public\.is_admin\(\)\)/);
assert.match(migration, /after insert or update on public\.place_submissions/);

const savedSubmissions = [];
let duplicateInsert = false;
let serviceAvailable = false;
let notifiedInput;
const routeClient = {
  from: () => ({ insert: async (value) => {
    if (duplicateInsert) return { error: { code: "23505" } };
    savedSubmissions.push(value);
    return { error: null };
  } }),
};
class MissingServiceConfiguration extends Error {}
const serviceClient = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { id: submissionId, notification_attempts: 0 }, error: null }) }) }) }) }) }) };
const publicRoute = compile("../app/api/submissions/route.ts", {
  "next/server": { NextResponse: response },
  "@/lib/i18n": { isLocale: (value) => ["ko", "zh", "en", "ja"].includes(value), ui: { ko: { submissions: { descriptionLabel: "설명", imageUrl: "사진", notes: "메모" } } } },
  "@/lib/map-url": { parseMapUrl: (value) => ({ sourceProvider: "NAVER", placeId: "1", normalizedUrl: value }) },
  "@/lib/server-supabase": { createServerAnonClient: () => routeClient, createServerServiceClient: () => { if (serviceAvailable) return serviceClient; throw new MissingServiceConfiguration(); }, ServerConfigurationError: MissingServiceConfiguration },
  "@/lib/submission-notifications": { notifyPlaceSubmission: async (input) => { notifiedInput = input; return input.submissionId ? { status: "sent", recorded: true } : { status: "failed", recorded: false }; } },
  "@/lib/place-submission-validation": { validateSubmissionLocation: ({ mapUrl, name, locationText }) => ({ valid: Boolean(mapUrl || (name && locationText)), error: "missing_place_location" }), buildSubmissionDuplicateSource: () => "map:test" },
  "@/types/database": { placeCategories: ["restaurant"] },
});
function publicRequest(body, origin = "https://example.test") {
  const raw = JSON.stringify(body);
  return { headers: new Headers({ origin, "content-type": "application/json", "content-length": String(raw.length) }), nextUrl: { host: "example.test" }, text: async () => raw };
}
const submissionBody = { locale: "ko", mapUrl: "https://map.naver.com/p/entry/place/1", reason: "추천합니다" };
assert.equal((await publicRoute.POST(publicRequest(submissionBody, "https://other.test"))).status, 403);
assert.equal((await publicRoute.POST(publicRequest({ ...submissionBody, reason: "" }))).status, 400);
assert.equal((await publicRoute.POST(publicRequest({ ...submissionBody, extraNotes: "가".repeat(6000) }))).status, 413);
const submitted = await publicRoute.POST(publicRequest(submissionBody));
assert.equal(submitted.status, 201);
assert.equal(submitted.body.notification.status, "failed");
assert.equal(savedSubmissions.length, 1);
assert.equal(savedSubmissions[0].status, "pending");
serviceAvailable = true;
const tracked = await publicRoute.POST(publicRequest({ ...submissionBody, mapUrl: "https://map.naver.com/p/entry/place/2" }));
assert.equal(tracked.status, 201);
assert.deepEqual(tracked.body.notification, { status: "sent", recorded: true });
assert.equal(notifiedInput.submissionId, submissionId);
duplicateInsert = true;
assert.equal((await publicRoute.POST(publicRequest(submissionBody))).status, 409);

console.log("Submission pipeline tests passed: transitions, double approval, failure recovery, notification result, and audit/RLS contracts.");
