# Place metadata enrichment

분류 기준:

- A: provider 또는 공식 위치 API에서 얻을 수 있는 사실정보
- B: AI가 작성할 수 있는 번역/편집 콘텐츠
- C: 관리자 확인 또는 직접 입력이 필요한 정보
- D: legacy 중복 필드이거나 현재 저장 모델에 직접 대응하지 않는 정보

| 필드 | 분류 | 데이터 출처 | 자동입력 |
| --- | --- | --- | --- |
| `slug` | C | 장소명 기반 초깃값, 관리자 수정 | 빈 값만 |
| `name_ko`, 기본 장소명 | A | provider display name | 빈 값만 |
| 다국어 장소명 | B | 관리자/향후 AI 번역 | 이번 단계 제외 |
| `category` | A/C | provider category의 보수적 enum mapping, 관리자 확인 | mapping 성공 시 빈 값만 |
| `address`, `address_ko` | A | provider 도로명 주소 우선 | 빈 값만 |
| `address_zh` | B | 관리자/향후 AI 번역 | 이번 단계 제외 |
| `latitude`, `longitude` | A | URL 또는 provider lookup | 유효한 기존 좌표가 없을 때 |
| `phone`, `website` | A | provider가 별도 factual 값으로 제공하는 경우 | 빈 값만, 지도 상세 URL은 website로 간주하지 않음 |
| `opening_hours` | A | provider weekday descriptions | 빈 값만 |
| `price_level` | A | provider 0~4 mapping | 빈 값만 |
| `price_min`, `price_max` | A/C | provider가 KRW 실제 범위를 제공할 때만 | 빈 값만 |
| `nearest_station`, `walking_minutes` | A/C | 좌표 기반 Kakao 지하철역 검색 또는 관리자 | 빈 값만 |
| `nearest_exit` | C | 관리자 확인 | 자동입력 안 함 |
| `thumbnail_url` | A/C | 관리자/기존 DB/영구 저장 가능한 provider image/fallback | 관리자/기존 DB 우선. Google 임시 Photo Media URL은 미리보기만 제공하고 저장하지 않음 |
| provider rating/review count | A | provider | form read-only 및 source metadata 저장 |
| `provider`, `external_id`, `source_url` | A | URL detect/parser | 자동입력 |
| `raw_metadata`, `last_synced_at` | A | provider normalized/raw result | source에 저장 |
| `admin_summary` | B/C | 검증된 provider 사실만 입력받는 별도 AI 요약, 관리자 검수 | 지도 정보 조회 시 자동 생성, 관리자 수정 가능 |
| 메뉴 및 실제 메뉴 가격 | A/C | 공식 source가 제공할 때만, 그 외 관리자 | 현재 provider API 미제공 |
| 주차/예약 가능/포장/화장실 | A/C | Google factual attributes 또는 관리자 | form 읽기 전용 표시 및 source metadata 저장, 의미가 같은 화장실만 canonical field 반영 |
| 짧은 설명, 여행 팁, 추천 주문 | B/C | 관리자/향후 AI 편집 콘텐츠 | provider가 채우지 않음 |
| waiting, 결제, 중국어 메뉴, 편의시설 | C | 관리자 검수 또는 명시적 provider fact | 추측하지 않음 |
| taste/중국인 추천 구조화 점수 | C | 관리자 검수 | 자동입력 안 함 |
| `is_featured`, `is_active`, `status` | C | 관리자 publication 결정 | 자동입력 안 함 |
| legacy boolean 편의 필드 | D | `place_china_info` tristate와 일부 중복 | 기존 호환 유지 |

## Value precedence

1. 현재 관리자 form 값
2. 기존 DB에서 form으로 불러온 값
3. provider factual data
4. AI 편집 콘텐츠

`admin_summary`는 사용자 제보 원문이나 다국어 생성용 관리자 메모가 아니다. 사용자 원문은 `place_submissions.recommendation_reason`/`notes`에 유지하며, AI 요약에는 정규화된 provider 사실만 전달한다.

Provider 재분석은 비어 있는 canonical 필드만 채운다. source provider, provider place ID, source metadata는 현재 분석한 URL의 최신 사실로 갱신한다.

## Duplicate detection

저장 전에 provider와 external ID의 동일 여부를 우선 확인한다. 그다음 30m 이내 좌표, 장소명과 주소 유사도를 확인한다. 정확한 provider ID 중복은 차단하고, 가능성만 있는 경우 자동 병합하지 않고 관리자 확인을 요구한다.

## Multi-source model

`places`는 canonical 장소 정보를 유지하고 `place_sources`는 provider별 source를 여러 행으로 보관한다. rating/review/raw response처럼 provider에 종속된 사실은 `places`에 복사하지 않고 `place_sources.raw_metadata`에 저장한다. 수집 시각은 기존 `last_synced_at`을 사용한다. 이번 migration은 `raw_metadata`만 추가하며 기존 source 행과 데이터는 변경하지 않는다.
