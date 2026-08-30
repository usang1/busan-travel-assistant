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

- Google Maps: Places API (New) Place Details를 우선 사용하고 Place ID가 없으면 Text Search를 사용한다.
- Naver Map: URL 사실정보를 우선 사용하고 검색 가능한 장소명이 있으면 Naver 지역 검색 API로 보강한다.
- Kakao Map: URL 사실정보를 우선 사용하고 검색 가능한 장소명이 있으면 Kakao 로컬 키워드 검색 API로 보강한다.

공식 API가 반환하지 않는 값은 채우지 않는다. 특히 Naver/Kakao의 공개 Local API는 provider place ID만으로 상세정보를 조회하는 API가 아니므로, ID만 있고 장소명과 좌표가 모두 없는 URL은 provider와 ID까지만 정규화될 수 있다.

## Server environment variables

```bash
GOOGLE_MAPS_API_KEY=
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
KAKAO_REST_API_KEY=
```

이 값에는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

## Provider setup

Google Cloud에서는 결제 계정을 연결하고 Places API (New)를 활성화한다. 서버 API key에는 API 제한으로 Places API (New)만 허용하고, 배포 환경에 맞는 애플리케이션 제한을 설정한다.

Naver Developers에서는 애플리케이션을 등록하고 검색 API의 지역 검색 사용 권한을 활성화한다. 발급된 Client ID와 Client Secret을 서버 환경변수로 설정한다.

Kakao Developers에서는 애플리케이션의 REST API key를 서버 환경변수로 설정한다. 로컬 API 호출은 `Authorization: KakaoAK ...` 헤더를 사용한다.

Google photo 응답은 API key가 필요한 photo resource name이므로 현재 `raw.photos`에만 보존하고 영구 `imageUrl`로 만들지 않는다. API key가 포함된 URL을 클라이언트나 DB에 저장하면 안 된다.
