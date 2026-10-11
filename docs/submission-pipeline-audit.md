# 장소 제보 운영 파이프라인 점검 (2026-10-11)

## 현재 코드 경로

1. `/[locale]/submissions`의 `PlaceSubmissionForm`이 지도 URL 또는 장소명+위치를 입력받고 `/api/submissions`에 전송한다.
2. 서버는 요청 출처, JSON 크기·필수 사유·장소 위치를 검사하고 `duplicate_key`를 만들어 `place_submissions`에 `pending`으로 저장한다. 038 마이그레이션의 부분 고유 인덱스가 진행 중인 동일 제보를 막는다.
3. DB 저장 후 Telegram을 시도한다. 전송 실패해도 제보 저장 성공은 201로 유지한다. `SUPABASE_SERVICE_ROLE_KEY`가 설정되면 제보 ID를 조회해 알림 상태·시도 시각·횟수를 기록한다. 키가 없으면 상태는 `미기록`이며 관리자 화면에서 재전송할 수 있다.
4. `/admin`의 `AdminSubmissionWorkflow`가 관리자 전용 목록, 제보 원문, 알림 상태, 작업 이력을 표시한다. `reviewing`은 보류·검토 중 상태다.
5. 상태 변경 API는 `approved`를 직접 받지 않는다. 승인 API가 서버에서 공개 payload를 검증하고 제보 행을 조건부 선점한 뒤 장소를 저장하고 제보를 `approved`로 연결한다. 성공하면 공개 장소 캐시 태그를 무효화한다.
6. 공개 목록·상세·지도·검색은 `is_active=true` 및 `status in ('PUBLISHED','ACTIVE')` 조건과 `isPublicPlace` 필터를 사용한다. 020/025 마이그레이션의 RLS도 공개 조건을 적용한다.

## 수정한 결함

| 중요도 | 재현 방법 (수정 전) | 처리 |
| --- | --- | --- |
| P0 | 관리자 PATCH에 `{"status":"approved"}`를 보내면 장소 생성 없이 승인 표시 | PATCH에서 직접 승인 금지, 허용 전환만 받음 |
| P0 | 승인된 제보를 PATCH로 거절해도 연결된 공개 장소는 그대로 보임 | 승인 상태를 종결 상태로 처리하고 연결된 장소가 있으면 일반 상태 변경 차단 |
| P1 | 동일 제보 승인 요청 2개가 동시에 장소 저장으로 진행 가능 | `approval_token` 조건부 선점, 409 충돌 응답, 실패 시 잠금 해제·오류 코드 기록 |
| P1 | Telegram 실패가 서버 로그에만 남고 관리자 재전송 방법 없음 | 알림 상태·시도 기록·관리자 재전송 API/화면 추가 |
| P1 | 제보의 `notes`에 저장된 설명·이미지 URL·추가 메모가 관리자 상세에서 가려짐 | 원문 전체와 위치를 검수 화면에 표시 |
| P1 | 공개가 아닌 payload로 제보 승인 가능 | 승인 API와 화면에서 공개 상태 검증 |
| P1 | 로그인 사용자가 자신의 pending 행의 임의 컬럼을 직접 수정하거나, 공개 INSERT 정책으로 승인 상태 행을 만들 수 있음 | 039 마이그레이션에서 사용자 직접 UPDATE 정책 제거, INSERT 정책에 pending/비연결/미검수 조건 추가 |

## 장애 복구

- 제보 INSERT 실패: API가 실패를 반환하고 입력 폼 값은 유지된다. DB 복구 후 같은 입력으로 다시 전송한다.
- 알림 실패: 제보는 유지된다. 서비스 키가 있으면 상태가 `failed` 또는 `skipped`로 기록되고, 키가 없으면 `미기록`으로 남는다. 관리자가 제보 상세의 **알림 재전송**을 사용한다. 상태가 `sent`면 중복 재전송을 막는다.
- 승인 실패: 새 장소 행을 만든 뒤 실패하면 비공개 보관 처리한다. 제보 선점을 해제하고 `approval_last_error`에 실패 단계를 남긴다. 관리자 작업 이력과 서버 구조화 로그로 확인 후 다시 승인한다. 15분을 넘은 선점은 다음 승인 요청에서 중단 작업으로 기록하고 회수한다.
- 승인 응답은 성공했으나 화면 목록 새로고침이 실패하면 성공 사실을 별도로 표시해 이중 승인을 유도하지 않는다.

승인과 장소 저장은 여러 테이블에 걸친 별도 요청이라 완전한 단일 DB 트랜잭션은 아니다. **기존 공개 장소 수정 중 최종 제보 상태 기록이 실패하면 일부 장소 변경이 먼저 반영될 수 있다.** 이 경우 `submission_finalize_failed`를 확인하고 재승인해 연결을 복구해야 한다. 운영에서 확인할 잔여 위험으로 남긴다.

## 040·041 마이그레이션과 설정

`040_submission_pipeline_operability.sql`은 기존 행을 삭제하지 않는다. 알림·승인 복구 열과 관리자 전용 이력 테이블/트리거를 추가하고 제보 INSERT/UPDATE RLS를 강화한다. 이력은 적용 시점 이후의 변경부터 기록한다. **staging에서 먼저 적용·확인한 뒤 이 코드와 함께 배포**해야 한다. 마이그레이션 전에는 새 승인·이력 API가 새 열을 찾지 못한다.

기존에 메뉴와 제보 마이그레이션이 같은 `039` 버전을 사용했던 배포를 복구하기 위해 `041_menu_variable_price_repair.sql`이 가격 변동 메뉴 스키마를 멱등적으로 다시 적용한다. 새 마이그레이션은 고유한 버전을 갖는지 자동 테스트한다.

필요한 서버 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(알림 결과의 즉시 기록), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. 토큰과 서비스 키는 서버 환경에만 설정한다.

staging 수동 검증은 운영 데이터와 구분되는 `QA-` 접두 장소명을 사용한다. 테스트 제보 ID에 대해 아래를 조회하고, 값이나 행을 삭제하지 않는다.

```sql
select id, status, place_id, notification_status, notification_attempts, approval_last_error
from public.place_submissions where id = '<QA submission UUID>';

select id, status, is_active from public.places
where id = '<linked QA place UUID>';

select event_type, previous_status, next_status, error_code, created_at
from public.place_submission_audit
where submission_id = '<QA submission UUID>' order by created_at desc;
```

테스트 순서: 익명·로그인 제보 → 중복 전송 409 → Telegram 실제 수신과 상태 `sent` → 관리자 보류·반려·재검토 → 승인 → 공개 목록·지도·검색에서 확인 → 동일 승인 재시도 409 → 테스트용 비공개 장소가 공개 목록에서 제외되는지 확인. 운영 DB에는 테스트 데이터를 만들지 않는다.

## 확인한 범위와 제한

`npm run test:submissions`는 실제 라우트 코드를 모의 DB/Telegram으로 실행해 필수값, 중복 INSERT, 동시 승인, 실패 후 잠금 해제, 알림 성공·실패, RLS 선언을 검사한다. 관리자 UI는 1440px/390px 브라우저에서 모의 API로 목록·상세·상태·이력·알림 재전송을 확인했다. 로컬 HTTP에서는 무인증 관리자 API 401, 출처 없는 제보 403, Supabase 미설정 상태의 유효 제보 503을 확인했다.

배포 사이트에 대한 읽기 전용 HTTP 확인에서는 `/ko/submissions`, `/ko/places`, `/ko/admin`이 각각 200, 무인증 `/api/admin/submissions`와 `/api/admin/places`가 각각 401이었다. 이 확인은 **현재 배포 버전의 라우트·무인증 차단만** 나타내며, 이번 변경 코드가 배포됐다는 뜻은 아니다.

현재 로컬 환경에는 Supabase 및 Telegram 접속 정보가 없으므로 실제 DB INSERT, 실제 Telegram 수신, staging의 RLS 실행, 공개 지도·검색 반영은 **BLOCKED**다. 모의 테스트 통과를 운영 환경 정상으로 판정하지 않는다.
