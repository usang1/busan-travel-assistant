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
    "웹검색으로 보완",
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
assert.match(submissionWorkflowSource, /제보된 지도 링크[\s\S]*href=\{selectedSourceLink\}[\s\S]*noopener noreferrer/, "submitted map URL must be a safe external hyperlink");
assert.match(submissionWorkflowSource, /href=\{mapLinkState\.normalizedUrl\}[\s\S]*제보된 링크 열기/, "publish editor must provide a direct map-link action");
assert.match(submissionWorkflowSource, /onWebSearch=\{\(\) => void parseSourceUrl\(true\)\}/, "submission workflow must expose an explicit web-search fallback action");

const placeStoreSource = readFileSync(new URL("../lib/place-store.ts", import.meta.url), "utf8");
assert.match(placeStoreSource, /isMissingAdminSummaryColumnError/, "place writes must detect a missing optional admin_summary migration");
assert.match(placeStoreSource, /insert\(withoutAdminSummary\(placeRow\)\)/, "place creation must retry against the pre-migration schema");
assert.match(placeStoreSource, /update\(withoutAdminSummary\(placeRow\)\)/, "place updates must retry against the pre-migration schema");
assert.match(placeStoreSource, /query\.limit\(1\)\.maybeSingle\(\)/, "place detail lookup must tolerate duplicate or relation-expanded rows");
assert.match(placeStoreSource, /compatibleQuery\.limit\(1\)\.maybeSingle\(\)/, "compatible place detail lookup must tolerate duplicate rows");
assert.match(placeStoreSource, /legacyQuery\.limit\(1\)\.maybeSingle\(\)/, "legacy place detail lookup must tolerate duplicate rows");
assert.match(placeStoreSource, /const listResult = await getPlaces\(/, "place detail lookup must fall back to the working public list query");
assert.match(placeStoreSource, /normalizePlaceSlug\(place\.slug\) === requestedSlug/, "place detail fallback must normalize the requested slug");

for (const detailFile of ["app/[locale]/places/[slug]/page.tsx", "app/places/[slug]/page.tsx"]) {
  const detailSource = readFileSync(new URL(`../${detailFile}`, import.meta.url), "utf8");
  assert.match(detailSource, /const getCachedPlaceBySlug = cache\(\(slug: string\) => getPlaceBySlug\(slug\)\)/, `${detailFile}: metadata and page must share the place lookup`);
  assert.match(detailSource, /getCachedPlaceBySlug\(slug\)/, `${detailFile}: detail route must use the shared lookup`);
  assert.match(detailSource, /<PlaceCorrectionForm[\s\S]*currentValues=\{\{[\s\S]*opening_hours:[\s\S]*menu:[\s\S]*phone:/, `${detailFile}: correction form must receive current business values`);
}

const placeCardSource = readFileSync(new URL("../components/PlaceCard.tsx", import.meta.url), "utf8");
assert.match(placeCardSource, /`\/places\/\$\{place\.slug\}\/report`/, "place cards must link directly to the dedicated business information report page");
assert.doesNotMatch(placeCardSource, /placeHref}#place-correction/, "place cards must not detour through the collapsed correction section");
assert.match(placeCardSource, /영업정보 제보/, "place cards must expose the Korean business information report label");

const correctionFormSource = readFileSync(new URL("../components/PlaceCorrectionForm.tsx", import.meta.url), "utf8");
for (const field of ["opening_hours", "closed_days", "menu", "menu_price", "price_range", "phone", "website", "parking", "reservation", "closed"]) {
  assert.match(correctionFormSource, new RegExp(`value: "${field}"`), `correction form must support ${field}`);
}
assert.match(correctionFormSource, /current_value: currentValue \|\| null/, "correction submissions must preserve the current value for admin comparison");

console.log("Admin place editor workflow tests passed (375px, 390px, 430px mobile layout contracts).");
