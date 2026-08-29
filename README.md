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
- 위치 기반 주변 추천과 네이버 지도 연동
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
NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=
```

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase 연결 정보입니다.
- `NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID`: Naver Maps JavaScript API v3 Web Dynamic Map 키입니다. 지도 표시와 관리자 주소 자동 좌표 변환에 사용합니다. 없으면 좌표 기반 fallback 지도가 표시됩니다.
- `NEXT_PUBLIC_SITE_URL`: canonical, OpenGraph, sitemap URL 생성에 사용합니다. Vercel 배포 후 실제 도메인으로 바꾸세요.
- `OPENAI_API_KEY`: 관리자 지도 링크 분석에서 설명 초안을 생성할 때만 서버에서 사용합니다. `NEXT_PUBLIC_`를 붙이지 마세요.

관리자 주소 자동 좌표 변환은 Naver Maps JavaScript API의 `geocoder` submodule을 사용합니다. Naver Cloud 콘솔에서 Web Dynamic Map/Geocoding 사용 설정과 localhost 및 배포 도메인 허용 설정이 필요합니다. 브라우저에서는 `NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID`만 사용하며, REST API secret이나 Supabase service role key를 노출하지 않습니다.

관리자 지도 링크 분석은 서버에서 `OPENAI_API_KEY`가 있을 때 OpenAI Responses API로 중국어/한국어 설명 초안을 생성합니다. 키가 없으면 장소명, 좌표, 지도 장소 ID만 분석하고 설명란은 비워 둡니다.

## Supabase 설정

Supabase SQL editor 또는 CLI에서 아래 순서로 실행합니다.

```bash
supabase/migrations/001_places_schema.sql
supabase/migrations/002_photo_spots.sql
supabase/migrations/003_multilingual_place_architecture.sql
supabase/migrations/004_auth_saves_and_action_events.sql
supabase/migrations/005_place_submission_admin_workflow.sql
supabase/migrations/006_security_baseline_hardening.sql
supabase/migrations/007_allow_anonymous_place_submissions.sql
supabase/migrations/008_china_specific_place_info.sql
supabase/migrations/009_china_admin_editor_fields.sql
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
- `place_china_info`: 중국인 자유여행객용 구조화 장소 정보. 점수형 항목은 1~5 또는 `null`, 확인형 항목은 `yes` / `no` / `unknown`으로 저장해 미확인 정보를 false처럼 취급하지 않습니다.

기존 `places.name_zh/name_ko` 계열 컬럼은 호환을 위해 유지합니다. `003_multilingual_place_architecture.sql`은 기존 중국어/한국어 데이터를 `place_translations`로 backfill하며, 새 기능은 점진적으로 번역 테이블을 우선 사용하도록 확장할 수 있습니다.

현재 기존 장소 테이블의 관리자 쓰기 권한은 MVP용 임시 정책에서 `profiles.role = 'admin'` 기반 RLS로 강화되고 있습니다. `place_china_info`는 활성 장소에 대한 공개 읽기와 관리자 전용 생성/수정을 사용합니다. 실제 공개 전 관리자 계정의 profile role을 설정해야 합니다.

## 중국인 특화 장소 운영

중국인 특화 정보는 `place_china_info`에 저장하며 기존 `places` 테이블은 유지합니다. 관리자 화면에서는 자연어 문장을 매번 쓰는 대신 구조화 입력을 먼저 채웁니다.

주요 필드:

- `chinese_taste_score`: 중국인 추천도 1~5
- `spicy_level`, `greasy_level`, `smell_level`, `portion_level`, `ordering_difficulty`: 맛/양/주문 난이도 1~5
- `waiting_level`: `none`, `short`, `moderate`, `long`, `extreme`, `varies`, `unknown`
- `chinese_menu`, `foreign_card`, `alipay`, `wechat_pay`, `solo_friendly`, `luggage_friendly`, `toilet_available`, `reservation_required`: `yes` / `no` / `unknown`
- `minimum_order_policy`: `none`, `two_plus`, `three_plus`, `other`, `unknown`
- `xiaohongshu_popular`, `photo_recommended`, `tourism_recommended`: 중국인 관광 목적 태그용 tri-state
- `manual_summary_override`, `manual_warning_override`: 자동 문장을 덮어쓰거나 우선 노출할 때만 입력

별점 의미:

- 매운맛: 1 전혀 안 매움, 2 거의 안 매움, 3 보통, 4 매움, 5 매우 매움
- 느끼함: 1 매우 담백, 2 담백한 편, 3 보통, 4 느끼한 편, 5 매우 느끼함
- 향/잡내: 1 거의 없음, 2 약함, 3 조금 느껴짐, 4 강함, 5 매우 강함
- 주문 난이도: 1 매우 쉬움, 2 쉬움, 3 보통, 4 어려움, 5 외국인이 주문하기 매우 어려움

`unknown`은 확인 필요 상태입니다. 확인하지 않은 정보를 `false`로 저장하지 않습니다. 사용자 화면에서는 해외카드, 중국어 메뉴, 혼밥, 웨이팅 같은 핵심 정보는 `暂未确认`으로 보여주고, 부가 unknown은 `更多信息暂未确认`에 접어 둡니다.

자동 중국어 문장은 `lib/place-china/format.ts`의 deterministic formatter가 생성합니다. 외부 AI API를 호출하지 않으며 같은 입력은 항상 같은 문장을 만듭니다. `manual_summary_override`가 있으면 자동 summary 대신 사용하고, `manual_warning_override`가 있으면 자동 warning 앞에 추가합니다.

중국인 전용 검색/지도 필터는 `lib/place-china/discovery.ts`에서 관리합니다. 현재 지원 필터는 `中文菜单`, `海外信用卡`, `支付宝`, `微信支付`, `一个人OK`, `行李箱OK`, `少排队`, `不辣`, `地铁步行5分钟以内`, `小红书热门`, `晚上营业`입니다. 비오는 날처럼 현재 DB 필드로 판단할 수 없는 조건은 아직 구현하지 않습니다.

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
4. 제보 기반 등록에서는 네이버 지도 링크를 넣고 `분석`을 누르면 장소명, 좌표, 지도 장소 ID를 채웁니다. `OPENAI_API_KEY`가 있으면 중국어/한국어 설명 초안과 여행 팁도 비어 있는 입력란에 채웁니다.
5. 직접 등록 화면에서는 한국어 주소를 입력한 뒤 `주소로 좌표 찾기`를 누르면 네이버 주소 검색 결과의 위도/경도가 자동 입력됩니다. 결과가 애매하면 위도/경도를 직접 보정할 수 있습니다.
6. 중국인 특화 영역에서 별점, yes/no/unknown, 웨이팅, 최소주문을 선택합니다.
7. Preview에서 실제 중국어 summary, 태그, warning을 확인합니다.
8. 직접 문장 수정은 특이사항이 있을 때만 `manual_*_override`에 입력합니다.
9. 활성/비활성, 추천 장소 여부를 설정합니다.
10. 저장하면 `/places`, `/nearby`, 상세 페이지에 바로 반영됩니다.

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
