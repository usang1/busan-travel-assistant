# 관리자 장소 폼 필드 점검 (2026-10-11)

## 화면과 저장 경로

`/ko/admin`의 수동 장소 등록·수정은 화면 폭에 관계없이 `AdminPlaceManager`와 동일한 `FormState`를 사용한다. `/zh/admin`, `/en/admin`, `/ja/admin`도 같은 `AdminShell`을 렌더링한다. 제보 승인용 `AdminSubmissionWorkflow`는 별도 업무 흐름과 `PublishForm`을 사용하지만, PC/모바일에 따라 폼을 분기하지 않는다.

기존 수동 폼의 6개 입맛 점수는 기본으로 닫히는 `고급 편집` 안에 있었다. PC에서 보이는 사례는 해당 영역을 펼쳤거나 제보 승인 폼을 사용한 경우로 설명된다. 모바일에서는 장소 목록이 입력 폼보다 먼저 쌓여 발견성이 더 나빴다. CSS breakpoint로 필드가 제거되거나 모바일 전용 state가 사용된 것은 아니다.

아래의 `동일`은 PC와 모바일의 **같은 컴포넌트와 값**을 뜻한다. `상세`은 양쪽 모두 기본으로 닫히는 상세 입력 영역에서 편집할 수 있다는 뜻이다. DB 표기는 실제 저장 대상 테이블이다.

| PC 입력 항목 | 모바일 입력 항목 | DB 필드 | 결과 |
| --- | --- | --- | --- |
| 지도 링크·지도 정보 불러오기 | 동일 | `place_sources.source_url`, `provider` 및 수집된 장소 필드 | PASS |
| 장소명 | 동일 | `places.name_ko`, `name_zh`; `place_translations.name` | PASS |
| 카테고리 | 동일 | `places.category` | PASS |
| 도시·구/군 | 동일 | `places.city_code`, `district_code`, 지역 태그 | PASS |
| 홈 카테고리·상황 필터 태그 | 동일 | `place_tags`/`tags` | PASS |
| 대표 메뉴·대표 메뉴 가격 (음식 분류) | 동일 | `place_menu_items.name_ko`, `price` | PASS |
| 웨이팅 (음식 분류) | 동일 | `place_china_info.waiting_level` | PASS |
| 가격대 | 동일 | `places.price_level` | PASS |
| 대표 이미지 업로드 | 동일 | `places.thumbnail_url` | PASS |
| 공개 상태·마지막 확인일·휴무일 | 동일 | `places.status`, `last_verified_at`, `closed_days` | PASS |
| AI 장소 요약(내부 메모) | 동일 | `places.admin_summary` | PASS |
| 중국인 추천도 | 접기/펼치기로 동일 값 | `place_china_info.chinese_taste_score` | 수정 전 발견 어려움 → PASS |
| 매운맛 | 접기/펼치기로 동일 값 | `place_china_info.spicy_level` | 수정 전 발견 어려움 → PASS |
| 느끼함 | 접기/펼치기로 동일 값 | `place_china_info.greasy_level` | 수정 전 발견 어려움 → PASS |
| 향/잡내 | 접기/펼치기로 동일 값 | `place_china_info.smell_level` | 수정 전 발견 어려움 → PASS |
| 양 | 접기/펼치기로 동일 값 | `place_china_info.portion_level` | 수정 전 발견 어려움 → PASS |
| 주문 난이도 | 접기/펼치기로 동일 값 | `place_china_info.ordering_difficulty` | 수정 전 발견 어려움 → PASS |
| 여행자 실용정보: 혼밥, 카드 결제, 짐 보관, 관광객 이용 편의, 주문 방식, 예약, 웨이팅, 화장실, 매운맛, 향신료, 고수, 양, 느끼함, 현금 필요, 중국어·영어 메뉴 | 동일 | `place_china_info.traveler_insights` JSONB | PASS |
| 정보 확인 상태·날짜·근거·여행자 확인 수·정보 충돌 | 동일 | `place_china_info.verification_status`, `verified_at`, `verification_basis`, `traveler_confirmation_count`, `has_information_conflict` | PASS |
| 지도 장소 ID·URL 주소명·상태·카테고리·장소명 (상세) | 동일 (상세) | `place_sources.external_id`, `places.slug`, `status`, `category`, `name_ko` | PASS |
| 중국어·한국어·영어·일본어 공개 설명 (상세) | 동일 (상세) | `places.short_description_zh/ko`, `place_translations.description` | PASS |
| 한국어·중국어·영어·일본어 주소 (상세) | 동일 (상세) | `places.address_ko/zh`, `place_translations.address` | PASS |
| 주소 좌표 변환·위도·경도 (상세) | 동일 (상세) | `places.latitude`, `longitude` | PASS |
| 전화번호·웹사이트 (상세) | 동일 (상세) | `places.phone`, `website` | PASS |
| 가까운 역·출구·도보 시간·지하철 도보 시간 (상세) | 동일 (상세) | `places.nearest_station`, `nearest_exit`, `walking_minutes`; `place_china_info.subway_walk_minutes` | PASS |
| 최소·최대 가격·가격대·운영시간 (상세) | 동일 (상세) | `places.price_min`, `price_max`, `price_level`, `opening_hours` | PASS |
| 휴무일·마지막 확인일·추천 장소 (상세) | 동일 (상세) | `places.closed_days`, `last_verified_at`, `is_featured` | PASS |
| 중국어 메뉴·응대, 해외카드, Alipay, WeChat Pay, 혼밥, 캐리어, 화장실, 예약 필요 (상세) | 동일 (상세) | 같은 이름의 `place_china_info` 9개 열 | PASS |
| 웨이팅·최소주문 정책/기타 설명·대기 최소/최대 분 (상세) | 동일 (상세) | `place_china_info.waiting_level`, `minimum_order_policy`, `minimum_order_people`, `minimum_order_note`, `waiting_minutes_min/max` | PASS |
| 小红书热门·사진 촬영·일반 관광 추천 (상세) | 동일 (상세) | `place_china_info.xiaohongshu_popular`, `photo_recommended`, `tourism_recommended` | PASS |
| 중국인 대상 설명·주의사항 직접 수정 (상세) | 동일 (상세) | `place_china_info.manual_summary_override`, `manual_warning_override` | PASS |
| 추천 주문 중국어·한국어 및 여행 팁 중국어·한국어·영어·일본어 (상세) | 동일 (상세) | `places.recommended_order_zh/ko`, `tips_zh/ko`; `place_translations.travel_tip` | PASS |
| 메뉴 추가·삭제, 메뉴명 KO/ZH, 가격/가격 변동, 정렬, 중국어 설명, 추천 메뉴 (상세) | 동일 (상세) | `place_menu_items`의 대응 열 | PASS |
| Provider·평점·리뷰 수·편의정보 (읽기 전용, 상세) | 동일 (읽기 전용, 상세) | `place_sources` 및 source metadata | PASS |

폼 state의 `name_en/ja`는 별도 이름 입력으로 노출하지 않고 통일된 장소명으로 저장한다. `is_active`는 공개 상태에서 파생된다. `minimum_order_people`은 최소주문 정책 선택에서 파생된다. `source_metadata`와 provider 값은 지도 분석 결과다. 이 항목들은 PC와 모바일 모두 동일하다. `tags_text`는 내부 state에는 있으나 직접 입력 UI가 어느 화면에도 없으며, 실제 태그 입력은 구조화된 홈/상황 선택으로 처리한다. 메뉴의 일부 자동 수집 메타데이터도 직접 편집 UI가 없으며 양쪽에서 동일하게 취급한다.

## 검증 범위

코드에서 `toForm(place)`는 `place.china_info`의 여섯 점수를 불러오고 `toPayload(form)`은 같은 `china_info`로 저장한다. 서버 `createPlace`/`updatePlace`는 `place_china_info`에 upsert하고 상세/목록 조회는 관계를 다시 읽는다. 브라우저에서는 로컬 저장 모드로 1440/768/390/360px에서 신규 작성, 수정, 체크/해제, 재선택, 긴 한중 텍스트, 필수값 검증, 가로 넘침, 높이 축소 후 저장을 확인했다. **운영 DB에 대한 실제 쓰기·다시 읽기는 관리자 세션과 Supabase 접속 설정이 없어 확인하지 못했다.** 실제 DB 완료 판정은 staging 관리자 계정으로 생성→반대 화면 폭에서 수정→재조회하고 `place_china_info` 6개 열을 확인해야 한다.
