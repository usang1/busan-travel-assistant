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
    "자동수집 / AI 결과 미리보기",
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
const placeManagerSource = readFileSync(new URL("../components/AdminPlaceManager.tsx", import.meta.url), "utf8");

for (const source of [placeManagerSource, submissionWorkflowSource]) {
  for (const label of ["대표 메뉴", "대표 메뉴 가격", "웨이팅"]) {
    assert.match(source, new RegExp(`label="${label}"`), `admin forms must expose ${label} in the primary form`);
  }
  assert.match(source, /홈 카테고리/, "admin forms must expose home category mappings in the primary form");
  assert.match(source, /homeIntentTagOptions\.map/, "admin home categories must be checkbox options");
  assert.doesNotMatch(source, /placeholder=\{"광안리 처음\\n밤 10시 이후"\}/, "admin forms must not use natural-language tag entry for home categories");
  for (const label of ["중국어 장소명", "영어 장소명", "일본어 장소명", "중국어명", "영어명", "일본어명"]) {
    assert.doesNotMatch(source, new RegExp(`label="${label}"`), `admin forms must not require a separate ${label} field`);
  }
  assert.match(source, /<AdminPlaceImageUpload/, "admin place forms must use the shared representative image uploader");
  assert.doesNotMatch(source, /label="대표 이미지 URL"|placeholder="관리자 이미지 URL"/, "admin place forms must not expose representative image URL inputs");
}
assert.match(placeManagerSource, /status: "PUBLISHED"/, "new admin places should default to public");
assert.match(placeManagerSource, /is_active: true/, "new admin places should default to active");
assert.match(placeManagerSource, /name_zh: unifiedName/, "place payload must reuse the Korean place name for the zh name field");
assert.match(placeManagerSource, /buildHomeIntentTags\(form\.home_intent_keys\)/, "place manager must persist selected home category mappings");
assert.match(placeManagerSource, /name_en: name/, "admin translation state must keep the en place name unified");
assert.match(placeManagerSource, /function needsAutoTranslation\(form: FormState\)/, "place manager must detect Korean fields that need automatic GPT translation");
assert.match(placeManagerSource, /const translated = await autoTranslateBeforeSave\(formToSave\);[\s\S]*const payload = toPayload\(formToSave\);/, "place manager must translate Korean inputs before building the save payload");
assert.match(submissionWorkflowSource, /name_zh: name/, "submission publishing must reuse the Korean place name for the zh name field");
assert.match(submissionWorkflowSource, /status: "PUBLISHED"/, "submission publishing should default to public");
assert.match(submissionWorkflowSource, /buildHomeIntentTags\(form\.home_intent_keys\)/, "submission publishing must persist selected home category mappings");
assert.match(submissionWorkflowSource, /mergePublishMenuDrafts\(form\.menu_items, incomingMenu\)/, "submission web enrichment must merge all discovered menus");
assert.match(placeManagerSource, /mergeMenuDrafts\(nextForm\.menu_items, incomingMenu\)/, "place manager web enrichment must merge all discovered menus");
assert.match(submissionWorkflowSource, /china_info: chinaInfo/, "submission publishing must persist waiting info through china_info");
assert.match(submissionWorkflowSource, /function needsAutoTranslation\(form: PublishForm\)/, "submission publishing must detect Korean fields that need automatic GPT translation");
assert.match(submissionWorkflowSource, /const translated = await autoTranslateBeforePublish\(formToPublish\);[\s\S]*const payload = buildPayload\(formToPublish\);/, "submission publishing must translate Korean inputs before building the publish payload");
assert.match(submissionWorkflowSource, /const existingPlaceId = selected && exactDuplicate \? exactDuplicate\.placeId : null;/, "submission publishing must reuse the existing place when a selected submission has the same provider place ID");
assert.match(submissionWorkflowSource, /JSON\.stringify\(existingPlaceId \? \{ payload, placeId: existingPlaceId \} : payload\)/, "submission publishing must pass the existing place id to the approval route");
assert.match(submissionWorkflowSource, /function formFromPlace\(place: PlaceWithRelations, submission\?: PlaceSubmissionRecord\): PublishForm/, "approved submissions must rebuild the review form from the linked place");
assert.match(submissionWorkflowSource, /places\.find\(\(place\) => place\.id === submission\.place_id\)/, "approved submissions must resolve their linked place id");
assert.match(submissionWorkflowSource, /setForm\(linkedPlace \? formFromPlace\(linkedPlace, submission\) : emptyForm\(submission\)\)/, "selecting an approved submission must restore its saved place fields");
assert.match(submissionWorkflowSource, /home_intent_keys: getHomeIntentKeysFromTags\(place\.tags\)/, "restored submissions must preserve home category selections");
assert.match(submissionWorkflowSource, /menu_items: place\.menu_items\.map/, "restored submissions must preserve saved menus");

assert.match(submissionWorkflowSource, /providerLookupNotice=\{providerLookupNotice\}[\s\S]*status=\{status\}/, "publish form must receive the current save status");
assert.match(submissionWorkflowSource, /<p role="status"[^>]*>\{status\}<\/p>/, "mobile publish controls must show save feedback beside the button");
assert.match(submissionWorkflowSource, /제보된 지도 링크[\s\S]*href=\{selectedSourceLink\}[\s\S]*noopener noreferrer/, "submitted map URL must be a safe external hyperlink");
assert.match(submissionWorkflowSource, /href=\{mapLinkState\.normalizedUrl\}[\s\S]*제보된 링크 열기/, "publish editor must provide a direct map-link action");
assert.match(submissionWorkflowSource, /onWebSearch=\{\(\) => void parseSourceUrl\(true\)\}/, "submission workflow must expose an explicit web-search fallback action");

const imageUploadSource = readFileSync(new URL("../components/AdminPlaceImageUpload.tsx", import.meta.url), "utf8");
assert.match(imageUploadSource, /type="file"/, "representative images must be selected from a file input");
assert.match(imageUploadSource, /\/api\/admin\/place-image/, "representative images must use the authenticated upload route");
assert.match(imageUploadSource, /Authorization: `Bearer \$\{accessToken\}`/, "image uploads must send the admin access token");
assert.match(imageUploadSource, /maxImageBytes = 8 \* 1024 \* 1024/, "client image uploads must enforce the 8MB limit");

const imageUploadRoute = readFileSync(new URL("../app/api/admin/place-image/route.ts", import.meta.url), "utf8");
assert.match(imageUploadRoute, /requireAdmin\(request\)/, "the image upload route must require an administrator");
assert.match(imageUploadRoute, /client\.storage\.from\(placeImageBucket\)\.upload/, "the image upload route must write to Supabase Storage");
assert.match(imageUploadRoute, /imageExtensions\[image\.type\]/, "the image upload route must allowlist image MIME types");
assert.match(imageUploadRoute, /image\.size <= 0 \|\| image\.size > maxImageBytes/, "the image upload route must reject empty and oversized files");
assert.match(imageUploadRoute, /matchesImageSignature\(image\.type, new Uint8Array\(bytes\)\)/, "the image upload route must verify actual file signatures");

const imageStorageMigration = readFileSync(new URL("../supabase/migrations/027_place_image_storage.sql", import.meta.url), "utf8");
assert.match(imageStorageMigration, /'place-images'/, "the place image storage migration must create the expected bucket");
assert.match(imageStorageMigration, /public\.is_admin\(\)/, "place image writes must be restricted to administrators");
assert.match(imageStorageMigration, /file_size_limit = excluded\.file_size_limit/, "the place image bucket must retain its size limit");

const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
assert.match(nextConfigSource, /\/storage\/v1\/object\/public\/place-images\/\*\*/, "Next Image must only allow the place image bucket path");

const placeStoreSource = readFileSync(new URL("../lib/place-store.ts", import.meta.url), "utf8");
assert.match(placeStoreSource, /adaptPlaceWriteRowForLegacySchema/, "place writes must adapt to older production schemas");
assert.match(placeStoreSource, /\["admin_summary", "closed_days", "last_verified_at"\]/, "place writes must omit unavailable optional columns on legacy schemas");
assert.match(placeStoreSource, /row\.status === "PUBLISHED" \? "ACTIVE" : "DRAFT"/, "place writes must map workflow statuses to legacy public statuses");
assert.match(placeStoreSource, /from\("places"\)\.insert\(compatiblePlaceRow\)/, "place creation must retry with a compatible row");
assert.match(placeStoreSource, /from\("places"\)\.update\(compatiblePlaceRow\)/, "place updates must retry with a compatible row");
assert.match(placeStoreSource, /query\.limit\(1\)\.maybeSingle\(\)/, "place detail lookup must tolerate duplicate or relation-expanded rows");
assert.match(placeStoreSource, /compatibleQuery\.limit\(1\)\.maybeSingle\(\)/, "compatible place detail lookup must tolerate duplicate rows");
assert.match(placeStoreSource, /legacyQuery\.limit\(1\)\.maybeSingle\(\)/, "legacy place detail lookup must tolerate duplicate rows");
assert.match(placeStoreSource, /const listResult = await getPlaces\(/, "place detail lookup must fall back to the working public list query");
assert.match(placeStoreSource, /normalizePlaceSlug\(place\.slug\) === requestedSlug/, "place detail fallback must normalize the requested slug");
assert.match(placeStoreSource, /findExistingPlaceIdForApproval/, "submission approval must be able to resume from an existing partial place");
assert.match(placeStoreSource, /from\("places"\)\.delete\(\)\.eq\("id", id\)/, "failed place creation must clean up its partial place row");
assert.match(placeStoreSource, /getMissingSchemaColumn/, "China info writes must tolerate optional columns missing from an older production schema");
assert.match(placeStoreSource, /runPlaceSaveStage\("메뉴"/, "place relation failures must identify the failing save stage for admins");

const approvalRouteSource = readFileSync(new URL("../app/api/admin/submissions/[id]/approve/route.ts", import.meta.url), "utf8");
assert.match(approvalRouteSource, /findExistingPlaceIdForApproval\(payload, client\)/, "reviewing submissions must reuse a matching provider or slug place");
assert.match(approvalRouteSource, /existingSubmission\.place_id \?\? placeId \?\? reusablePlaceId/, "linked, detected, and recovered place ids must be applied in priority order");

for (const detailFile of ["app/[locale]/places/[slug]/page.tsx", "app/places/[slug]/page.tsx"]) {
  const detailSource = readFileSync(new URL(`../${detailFile}`, import.meta.url), "utf8");
  assert.match(detailSource, /getCachedPublicPlaceBySlug/, `${detailFile}: metadata and page must share the public place cache`);
  assert.match(detailSource, /getCachedPublicPlaceBySlug\(slug\)/, `${detailFile}: detail route must use the shared lookup`);
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
