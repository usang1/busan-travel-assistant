import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const editorFiles = [
  "components/AdminPlaceManager.tsx",
  "components/AdminSubmissionWorkflow.tsx",
];

for (const file of editorFiles) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

  for (const label of [
    "1. 지도 링크",
    "2. 관리자 기본 입력",
    "3. 자동수집 / AI 결과 미리보기",
    "장소 정보 불러오기",
    "AI 콘텐츠 생성",
    "고급 편집 펼치기",
  ]) {
    assert.ok(source.includes(label), `${file}: missing workflow label: ${label}`);
  }

  assert.match(source, /<details className="group[^>]*>/, `${file}: advanced editor must use a native, initially closed details element`);
  assert.match(source, /grid grid-cols-4/, `${file}: locale tabs must remain four stable columns on mobile`);
  assert.match(source, /min-h-12 w-full[^"\n]*sm:w-auto/, `${file}: primary actions must be full-width touch targets below the sm breakpoint`);
  assert.match(source, /flex flex-col[^"\n]*sm:flex-row/, `${file}: compact horizontal controls must stack below the sm breakpoint`);
}

for (const viewportWidth of [375, 390, 430]) {
  assert.ok(viewportWidth < 640, `${viewportWidth}px must use the tested mobile-first layout before Tailwind's sm breakpoint`);
}

const submissionWorkflowSource = readFileSync(new URL("../components/AdminSubmissionWorkflow.tsx", import.meta.url), "utf8");
assert.match(submissionWorkflowSource, /providerLookupNotice=\{providerLookupNotice\}[\s\S]*status=\{status\}/, "publish form must receive the current save status");
assert.match(submissionWorkflowSource, /<p role="status"[^>]*>\{status\}<\/p>/, "mobile publish controls must show save feedback beside the button");

const placeStoreSource = readFileSync(new URL("../lib/place-store.ts", import.meta.url), "utf8");
assert.match(placeStoreSource, /isMissingAdminSummaryColumnError/, "place writes must detect a missing optional admin_summary migration");
assert.match(placeStoreSource, /insert\(withoutAdminSummary\(placeRow\)\)/, "place creation must retry against the pre-migration schema");
assert.match(placeStoreSource, /update\(withoutAdminSummary\(placeRow\)\)/, "place updates must retry against the pre-migration schema");

console.log("Admin place editor workflow tests passed (375px, 390px, 430px mobile layout contracts).");
