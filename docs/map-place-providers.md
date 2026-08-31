# Map place providers

관리자 지도 링크 분석은 다음 서버 흐름을 사용한다.

```text
source URL
  -> provider detection
  -> HTTP redirect resolution
  -> URL fact and provider place ID parsing
  -> official provider API lookup
  -> NormalizedPlace
  -> admin form
```

## Supported providers

- Google Maps: Places API (New) Place Details를 우선 사용하고 Place ID가 없으면 Text Search를 사용한다. 공식 응답의 영업시간, 전화, website, 가격 범위, rating, review count, types, 사진, 주차/예약/포장/화장실 사실을 정규화한다.
- Naver Map: URL 사실정보를 우선 사용하고 검색 가능한 장소명이 있으면 NAVER API HUB 지역 검색으로 보강한다. 기존 Developers 키는 유예기간 호환용으로 지원한다.
- Kakao Map: URL 사실정보를 우선 사용하고 검색 가능한 장소명이 있으면 Kakao 로컬 키워드 검색 API로 보강한다.

공식 API가 반환하지 않는 값은 채우지 않는다. 특히 Naver/Kakao의 공개 Local API는 provider place ID만으로 상세정보를 조회하는 API가 아니므로, ID만 있고 장소명과 좌표가 모두 없는 URL은 provider와 ID까지만 정규화될 수 있다.

## Server environment variables

```bash
GOOGLE_MAPS_API_KEY=
NAVER_API_HUB_CLIENT_ID=
NAVER_API_HUB_CLIENT_SECRET=
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
KAKAO_REST_API_KEY=
```

이 값에는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## Provider setup

Google Cloud에서는 결제 계정을 연결하고 Places API (New)를 활성화한다. 서버 API key에는 API 제한으로 Places API (New)만 허용하고, 배포 환경에 맞는 애플리케이션 제한을 설정한다.

NAVER Cloud Platform에서 NAVER API HUB를 신청하고 지역 검색 권한과 Client ID/Secret을 발급한다. 2026년 7월 31일 이전에 Developers 검색 API를 신청한 기존 사용자는 2027년 6월 30일까지 legacy 키를 사용할 수 있다.

Kakao Developers에서는 애플리케이션의 REST API key를 서버 환경변수로 설정한다. 로컬 API 호출은 `Authorization: KakaoAK ...` 헤더를 사용한다.
같은 Kakao Local API의 지하철역 카테고리 검색을 사용해 유효한 좌표에서 가장 가까운 역과 직선거리 기반 도보 예상 시간을 선택적으로 채운다. 결과가 없거나 key가 없으면 비워 둔다.

Google 사진은 Place Details의 photo resource name으로 Photo Media를 호출해 최대 3개의 관리자 미리보기 URL과 attribution을 만든다. photo resource name은 캐시할 수 없고 만료될 수 있으므로 `raw_metadata`와 `thumbnail_url`에는 저장하지 않는다. 저장 가능한 관리자 이미지가 없으면 기존 fallback 이미지 정책을 사용한다.

같은 URL의 provider 조회는 서버 인스턴스에서 5분간 재사용한다. 최신 영업시간 갱신이 가능하도록 영구 캐시로 취급하지 않으며, 저장 시 `place_sources.last_synced_at`을 기록한다.
