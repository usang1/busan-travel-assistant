# SNS 장소 찾기 운영 가이드

## 데이터 흐름

1. 사용자는 공개 SNS 링크, 복사한 본문, 장소명 또는 캡처를 입력합니다.
2. 링크는 `http`/`https`와 허용된 SNS 호스트만 받습니다. 서버는 해당 URL을 방문하지 않으며 쿼리와 fragment를 제거합니다.
3. 텍스트와 선택적 OCR 결과에서 장소명, 지역, 역, 메뉴, 주소 일부, 랜드마크, 해시태그만 추출합니다.
4. 후보는 `getCachedPublicPlaces(locale, "busan")`가 반환한 공개·활성·검수 장소로 제한합니다.
5. 낮은 신뢰도도 후보일 뿐 자동 확정하지 않습니다. 사용자의 "이 장소가 맞아요"는 `needs_review`로 저장됩니다.
6. 관리자가 `/ko/admin#social-discovery`에서 별칭과 후보를 검토한 뒤 승인해야 이후 동일 별칭 또는 URL 해시에 활용됩니다.

원문 게시물 본문, 원본 URL, IP 주소, 캡처 파일은 DB와 스토리지에 저장하지 않습니다. URL은 추적·세션 파라미터를 제거한 뒤 SHA-256 해시만 저장합니다. 익명 기기 쿠키는 `HttpOnly`, `SameSite=Lax`이며 DB에는 서버 HMAC 값만 저장합니다.

## 환경변수

- `SUPABASE_SERVICE_ROLE_KEY`: rate limit, 비공개 매핑 원본, 익명 소유권 확인에 사용합니다. 서버 전용입니다.
- `SOCIAL_DISCOVERY_HASH_SECRET`: 32자 이상의 무작위 서버 secret입니다. 없으면 기존 `TRAVELER_REPORT_HASH_SECRET`을 호환 사용합니다.
- `SOCIAL_DISCOVERY_IMAGE_ENABLED`: 개인정보 검수 절차와 OpenAI 설정이 준비된 경우에만 `true`로 설정합니다.
- `OPENAI_API_KEY`: 이미지 OCR에서만 사용합니다. 텍스트 후보 검색에는 필요하지 않습니다.
- `OPENAI_SOCIAL_DISCOVERY_MODEL`: 이미지 단서 추출 모델입니다. 비우면 `OPENAI_PLACE_MODEL`, 이후 `gpt-5-mini` 순으로 대체합니다.

Vercel의 Production/Preview 환경에 서버 변수를 따로 설정합니다. `SUPABASE_SERVICE_ROLE_KEY`, hash secret, OpenAI 키에는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

## 이미지 정책

- JPG, PNG, WebP만 허용하며 최대 4MB입니다.
- 확장자나 MIME 선언만 믿지 않고 magic bytes를 검사합니다.
- 캡처는 메모리에서 OpenAI Responses API로 전달하고 `store: false`를 사용합니다.
- 사용자명, 프로필, 얼굴, 댓글, 반응 수는 추출 대상에서 제외합니다.
- OCR 실패와 업로드 검증 실패를 구분합니다. 원본을 재사용하거나 장기 보관하지 않습니다.

## DB 적용과 롤백

`034_social_discovery_matching.sql`은 기존 `sns_place_mappings`, `sns_place_candidates`를 확장하고 `social_discovery_requests` 및 service-role 전용 rate-limit RPC를 추가합니다. 기존 `030` 파일은 수정하지 않습니다.

롤백 시 먼저 사용자 기능과 API 배포를 되돌린 뒤 RPC와 `social_discovery_requests`를 제거합니다. 확장 컬럼을 제거하면 운영자가 승인한 별칭·후보 근거·사용자 확인 이력이 삭제되므로 백업 후 진행해야 합니다. `source_platform/source_url_hash`의 기존 unique constraint는 익명 사용자 간 검수 행 공유를 막기 위해 제거하므로, 과거 제약을 복원하기 전 중복 해시를 정리해야 합니다.

## 운영 검수

- `후보 없음`: 기존 장소 중복을 다시 검색한 뒤 신규 장소 제보 큐를 확인합니다.
- `낮은 신뢰도`: 한국어 상호와 주소를 직접 대조합니다.
- `중복 후보`: 점수가 비슷한 후보를 모두 열어 확인합니다.
- `사용자 확인`: 승인 근거가 아니라 우선 검토 신호로만 사용합니다.
- 잘못 승인한 경우 `매핑 해제`로 공개 alias 활용을 중단하고 `needs_review`로 되돌립니다.
