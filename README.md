# 釜山旅行助手 Busan Travel Assistant

중국인 자유여행객이 부산 광안리에서 바로 쓸 수 있는 모바일 중심 여행 도구 MVP입니다.

사용자 화면은 중국어 간체를 기본으로 하며 `/zh`, `/en`, `/ja`, `/ko` locale URL 기반 확장을 준비했습니다. 관리자 화면은 한국어로 제공합니다. 실제 업체 정보는 Supabase 관리자 데이터만 노출하며, 환경 변수가 없는 로컬 환경에서는 명확한 Demo 데이터로 fallback됩니다.

## 기술 스택

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel 배포 구조
- PWA 확장용 `manifest.webmanifest`

## 주요 기능

- 광안리 장소 검색, 카테고리/조건 필터
- 장소 상세, 메뉴, 주문 추천, 직원에게 보여주기
- 사진스팟 목록/상세, FREE/PRO 잠금
- 한국인에게 보여주기 번역 카드
- 짐보관 리스트
- 위치 기반 주변 추천과 지도 fallback
- DB 기반 rule engine 여행 일정 생성
- Mock 결제로 PRO 권한 활성화
- localStorage 저장/공유 기능
- 한국어 관리자 장소 CRUD와 대시보드
- locale별 SEO metadata, hreflang, sitemap, OpenGraph, robots, legal page 초안

## 설치

```bash
npm install
cp .env.example .env.local
npm run dev
```

로컬 기본 주소는 `http://localhost:3000`입니다.

## 환경 변수

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 연결 정보입니다.
- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`: Kakao 지도 키입니다. 없으면 지도 대신 리스트 fallback이 표시됩니다.
- `NEXT_PUBLIC_SITE_URL`: canonical, OpenGraph, sitemap URL 생성에 사용합니다. Vercel 배포 후 실제 도메인으로 바꾸세요.

## Supabase 설정

Supabase SQL editor 또는 CLI에서 아래 순서로 실행합니다.

```bash
supabase/migrations/001_places_schema.sql
supabase/migrations/002_photo_spots.sql
supabase/migrations/003_multilingual_place_architecture.sql
supabase/seed.sql
```

테이블:

- `places`: 장소 기본 정보, 가격, 위치, 운영시간, 시설, 추천 문구
- `place_translations`: 장소명, 설명, 여행 팁의 locale별 번역
- `place_sources`: NAVER/KAKAO/GOOGLE/MANUAL 공식 소스 연결용 참조
- `tags`: 중국어/한국어 태그
- `place_tags`: 장소-태그 관계
- `place_menu_items`: 음식점 메뉴 정보
- `photo_spots`: 사진스팟과 FREE/PRO 구분
- `profiles`: Supabase Auth 사용자 프로필과 role
- `place_saves`: 사용자별 장소 저장, `unique(user_id, place_id)` 적용
- `place_submissions`: 사용자 장소 제보
- `place_events`: 장소별 이벤트
- `place_corrections`: 장소 정보 수정 요청

기존 `places.name_zh/name_ko` 계열 컬럼은 호환을 위해 유지합니다. `003_multilingual_place_architecture.sql`은 기존 중국어/한국어 데이터를 `place_translations`로 backfill하며, 새 기능은 점진적으로 번역 테이블을 우선 사용하도록 확장할 수 있습니다.

현재 기존 장소 테이블의 관리자 쓰기 권한은 MVP용 임시 정책입니다. 새 확장 테이블은 Supabase Auth와 `profiles.role = 'admin'` 기반 RLS를 준비했습니다. 실제 공개 전 관리자 계정의 profile role을 설정해야 합니다.

## 로컬 실행

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## 관리자 사용법

1. `/admin`으로 이동합니다.
2. 장소 수, 카테고리별 장소, 추천 장소, PRO 사진스팟, 최근 수정 장소를 확인합니다.
3. 장소 추가/수정 폼에서 기본정보, 위치, 가격, 운영시간, 시설, 중국인 관광객용 안내, 추천 주문, 사진 URL, 메뉴를 입력합니다.
4. 활성/비활성, 추천 장소 여부를 설정합니다.
5. 저장하면 `/places`, 홈 추천, 상세 페이지에 바로 반영됩니다.

Supabase 환경 변수가 없으면 관리자 CRUD는 브라우저 localStorage 기반 Demo 모드로 동작합니다.

## 새 장소 등록 기준

- 확인되지 않은 실제 업체명을 임의 생성하지 않습니다.
- 가격, 운영시간, 웨이팅 정보는 변동 가능하므로 방문 전 확인 안내를 유지합니다.
- 중국어 사용자 UI에는 간체 중국어를 쓰고, 관리자/코드 데이터에는 한국어 의미를 함께 남깁니다.
- 사진 URL은 사용 권한이 명확한 이미지 또는 직접 촬영/관리자가 승인한 이미지만 사용합니다.

## Vercel 배포

1. Git 저장소를 Vercel에 연결합니다.
2. Environment Variables에 `.env.local`과 동일한 키를 등록합니다.
3. `NEXT_PUBLIC_SITE_URL`을 실제 배포 도메인으로 설정합니다.
4. Build Command는 `npm run build`, Output 설정은 Next.js 기본값을 사용합니다.
5. 배포 후 `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`를 확인합니다.

## 실제 출시 전 필수 작업

- Supabase Auth 기반 관리자 인증/권한
- RLS 정책 강화
- 실제 업체 정보 검수
- 개인정보처리방침/이용약관 법무 검토
- 지도 API production key와 도메인 제한
- 결제 PG 연동 전 법인/정산/환불 정책 정리
- Core Web Vitals 실측과 모바일 실기기 QA
