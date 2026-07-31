# Bun Fullstack Boilerplate (+ 모바일 앱)

React + Bun + Bun server 기반의 풀스택 모노레포 보일러플레이트입니다. 서버와 클라이언트가
하나의 저장소에서 살고, 공통 코드는 `src/shared`에 둡니다.

여기에 **Expo(React Native) 앱 레이어가 `apps/mobile`로 얹혀 있습니다.** 웹 브라우저용
클라이언트와 모바일 앱이 같은 서버·같은 계약(`src/shared`)을 공유합니다. 원본 보일러플레이트의
구조(`src/{client,server,shared}`)는 그대로 두고 그 위에 쌓는 방식이라, 업스트림 보일러플레이트
변경사항을 계속 머지할 수 있습니다 — 자세한 규칙은 [모바일 앱 레이어](#모바일-앱-레이어-appsmobile)
참고.

```
src/
├── shared/          # 서버·클라이언트·앱 공통 (세 곳 모두에서 import 가능)
│   ├── validation/  # 스키마 검증 파사드 (현재 zod/mini, 교체 가능)
│   ├── i18n/        # 로케일 협상 + 메시지 카탈로그 (en/ko)
│   ├── time/        # UTC 전용 시간 유틸 (경계에서만 타임존 변환)
│   ├── semver/      # 앱 버전 비교 (버전 정책/업데이트 판단용)
│   ├── api/         # 페이지네이션(페이지·커서) 규약, 에러 엔벨로프, 헤더/버전
│   └── domain/      # 도메인 타입 + 검증기 (공용 계약)
│                    #   todo / version-policy / app-config / push-token / platform
├── server/          # Bun server (API + 클라이언트 서빙 + 워커)
│   ├── http/        # 라우트 공통 미들웨어 (CORS, 버전, 426 게이트, 에러, locale)
│   ├── routes/      # 엔드포인트 정의 (todos / version-policy / app-config / push / admin)
│   ├── services/    # 비즈니스 로직 (트랜잭션 경계가 여기서 드러남)
│   ├── repositories/# 영속성 계약 + postgres/in-memory 구현
│   ├── push/        # 푸시 발송 파사드 (dry-run / expo 드라이버)
│   ├── db/          # Bun 내장 SQL 드라이버, 마이그레이션 러너
│   ├── pubsub/      # 인스턴스 간 통신 (memory/redis 드라이버)
│   └── container.ts # 컴포지션 루트 — 프로세스당 싱글톤 관리
└── client/          # React SPA
    ├── api/         # ★ 모든 API가 endpoints.ts 한 곳에 문서화되어 모임
    ├── ui/          # 디자인 시스템 컴포넌트
    ├── styles/      # 디자인 토큰 (라이트/다크 × 디자인 A/B)
    ├── theme/ i18n/ # 테마·로케일 컨텍스트
    ├── testing/     # data-testid 레지스트리 (docs/ui-automation.md 참고)
    └── pages/       # Todos(데모), Design System, NotFound

apps/
└── mobile/          # Expo(React Native) 앱 — iOS/Android
    ├── src/api/     # ★ 앱의 API 카탈로그 (endpoints.ts) + TanStack Query 훅
    ├── src/boot/    # 부트 상태 머신 (config·정책·광고 슬롯 게이트)
    ├── src/version/ # 강제/선택 업데이트, OTA·스토어 파사드
    ├── src/config/  # 원격 설정(캐시·폴링·WS 푸시), 환경 변수
    ├── src/theme/   # 디자인 토큰 (라이트/다크 × 디자인 A/B)
    ├── src/i18n/    # 앱 메시지 카탈로그 + 로케일 컨텍스트
    ├── src/testing/ # testID 레지스트리 (docs/ui-automation-mobile.md 참고)
    ├── src/voice/   # ★ 음성 명령이 실제로 실행되는 곳 (Siri/Bixby/Assistant 공통)
    ├── native/      # 주입용 Swift / Android XML (대부분 카탈로그에서 생성)
    ├── plugins/     # Expo config plugin (prebuild 시 네이티브 주입)
    └── e2e/         # Maestro 플로우

capsule/             # Bixby Capsule — 삼성 클라우드에서 도는 별도 프로젝트
```

## 시작하기

```bash
bun install               # 의존성 설치 (+ husky 훅 설치)
cp .env.example .env      # 환경 설정 — 비밀값은 절대 커밋 금지

bun run db:setup          # docker로 Postgres 기동 + 마이그레이션 + 시드 (한 번에)
bun run dev               # 개발 서버 (서버 watch + 클라이언트 HMR) → http://localhost:3000
bun run dev:mobile        # Expo 개발 서버 (앱은 위 서버를 API로 사용)
```

DB 없이 바로 실행하려면 `.env`에서 `DB_DRIVER=memory`로 바꾸면 됩니다(테스트도 이 드라이버를 사용).

`bun install`은 워크스페이스 루트에서 한 번만 실행하면 앱 의존성까지 함께 설치됩니다.

| 명령                       | 설명                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `bun run dev`              | 개발 모드. 서버 자동 재시작 + 클라이언트 HMR                               |
| `bun run dev:mobile`       | Expo 개발 서버 (`APP_ENV=staging` 버전은 `dev:mobile:staging`)             |
| `bun test`                 | 단위 + API 통합 + 앱 로직 테스트. 외부 환경 불필요 (in-memory DB)          |
| `bun run check`            | prettier + eslint + tsc(웹·앱) + knip + test 전체 게이트 (pre-push와 동일) |
| `bun run build`            | 프로덕션 빌드 → `dist/` (서버가 클라이언트를 포함하는 단일 산출물)         |
| `bun run start`            | 빌드 산출물 실행                                                           |
| `bun run db:*`             | `db:up` / `db:migrate` / `db:seed` / `db:setup`                            |
| `bun run typecheck:mobile` | 앱만 타입체크 (앱은 React Native 타입 환경이라 tsconfig가 분리됨)          |

## 아키텍처 결정

### 의존 방향 (ESLint로 강제)

- `client` → `server` 런타임 import **금지** (타입 전용 import는 허용).
- `shared` → `server`/`client` import 금지.
- `zod`는 `src/shared/validation` 안에서만 import 가능 — 나머지는 전부 파사드를 통합니다.

### 검증 파사드 (`@shared/validation`)

모든 소비자는 라이브러리 중립적인 `Validator<T>` 인터페이스(`parse`/`safeParse`)에만
의존합니다. 현재 구현은 zod/mini이며, yup 등으로 바꾸려면 어댑터 하나를 새로 쓰고
스키마 정의 파일만 갱신하면 됩니다. 라우트·폼·설정 로딩 코드는 전혀 바뀌지 않습니다.

### 시간 정책

서버 내부는 항상 UTC입니다(`process.env.TZ = 'UTC'`, DB는 `timestamptz`, 애플리케이션은
`UtcIsoString` 브랜드 타입). 타임존 변환은 오직 경계에서만 — 클라이언트가
`formatUtcInTimeZone`으로 표시할 때 수행합니다.

### 목록 API 규약 (`@shared/api/pagination`, `@shared/api/cursor-pagination`)

모든 목록 엔드포인트는 **두 가지 페이지네이션 모드**를 같은 구현으로 서빙합니다.

- **페이지 모드(웹 기본)**: `?page&pageSize&sortBy&sortOrder` + 엔드포인트별 평면 필터.
  `Page<T>` 엔벨로프(`items/page/pageSize/totalItems/totalPages/hasNextPage`)로 응답.
- **커서 모드(앱 무한 스크롤)**: `?limit&cursor&sortBy&sortOrder` + 동일 필터.
  `CursorPage<T>`(`items/nextCursor`)로 응답. keyset 방식이라 스크롤 중 행이 추가·삭제돼도
  중복·누락이 없고, 깊은 페이지에서도 `count(*)`가 없어 비용이 일정합니다.

`limit` 또는 `cursor`가 오면 커서 모드, 아니면 페이지 모드입니다. 커서 값은 클라이언트에
**불투명(opaque)** 하며 정렬 파라미터가 박혀 있어 다른 정렬로 재사용하면 400입니다.
정렬 필드는 엔드포인트별 화이트리스트로만 허용됩니다.

### 환경 설정

로컬/개발/운영 전환은 `.env`(또는 배포 환경 변수) 교체 한 번으로 끝나며 코드 수정이
필요 없습니다. 모든 설정은 부팅 시 `src/server/config.ts`에서 검증됩니다.
`.env*`는 gitignore되어 있고 `.env.example`만 커밋합니다.

### 데이터베이스

- 기본 Postgres(Bun 내장 SQL 클라이언트, 외부 패키지 없음). 리포지토리 인터페이스
  (`src/server/repositories/types.ts`) 뒤에 있어서 다른 DB로 교체하려면 구현 파일 하나만
  새로 쓰면 됩니다. 테스트·로컬용 in-memory 구현이 이미 동일 계약을 따릅니다.
- 마이그레이션: `migrations/NNNN_name.sql` 파일이 곧 스키마 이력입니다.
  `bun run db:migrate`가 순서대로 적용하고 `schema_migrations`에 기록하며, advisory lock으로
  다중 인스턴스 동시 기동에도 안전합니다. 시드는 `bun run db:seed`(멱등).
- 트랜잭션 경계는 서비스 계층의 `uow.run(async (tx) => { … })` 블록으로 명시됩니다
  (예: `TodoService.create` — todo insert + audit log가 원자적).
- N+1: 목록 조회는 `count(*) OVER ()` 윈도 함수로 데이터+총계를 한 번에 가져옵니다.
  연관 행이 생기면 행별 쿼리 대신 `WHERE id IN (…)` 배치 조회를 사용하세요
  (리포지토리 주석 참고).

### 수평 확장

- **pub/sub 버스** (`src/server/pubsub`): 인스턴스 간 통신 추상화. 기본 `memory`,
  다중 인스턴스에서는 `PUBSUB_DRIVER=redis`(+`REDIS_URL`)로 전환 — Bun 내장 Redis
  클라이언트를 사용하며 코드 변경이 없습니다.
- **워커 역할**: `SERVER_ROLE=web|worker|all`. 같은 바이너리를 HTTP 전용/백그라운드 잡
  전용으로 나눠 띄울 수 있습니다. 잡은 pub/sub `jobs` 채널로 흐릅니다(`src/server/worker.ts`).
- **싱글톤**: 컨테이너(`src/server/container.ts`)에서 resolve되는 모든 서비스는 프로세스당
  싱글톤(lazy + memoized)입니다. 새로 싱글톤이 필요하면 같은 방식으로 등록하면 됩니다.
- **WebSocket**: `/ws`로 todo 변경 이벤트와 원격 설정 변경(`{type:'config.changed'}`)을
  push합니다. 브리지(`bridgePubSubToWebSocket`)가 pub/sub을 경유하므로 redis 드라이버에서는
  다른 인스턴스에 붙은 소켓에도 팬아웃됩니다.

### Graceful shutdown & 롤링 배포 버전 스큐

SIGTERM/SIGINT 수신 시: ① readiness가 즉시 503으로 바뀌어 LB가 트래픽을 뺌
(`SHUTDOWN_DRAIN_MS` 동안 대기) → ② 처리 중인 요청을 끝까지 마친 뒤 리스너 종료
→ ③ DB/Redis 등 자원 정리 후 종료.

롤링 배포 중 구버전 클라이언트 ↔ 신버전 서버(또는 그 반대) 조합 문제는 버전
핸드셰이크로 차단합니다: 빌드 시 git SHA가 서버·클라이언트 번들 양쪽에 주입되고
(`APP_BUILD_VERSION` define), 클라이언트는 모든 API 요청에 `X-App-Version` 헤더를
보냅니다. 불일치 시 서버가 409 `VERSION_MISMATCH`를 반환하고 클라이언트는 1회
새로고침하여 새 서버의 에셋을 받아옵니다. 서버 번들이 자신과 같은 빌드의 클라이언트를
내장하므로(단일 산출물) 항상 정합성이 보장됩니다. (`src/shared/api/version.ts`)

앱은 같은 `X-App-Version` 헤더에 **스토어 버전(semver)** 을 담아 보내되 `X-Platform`
(`ios|android`)을 함께 보냅니다. 서버는 `X-Platform` 유무로 두 검사를 가릅니다 —
헤더가 없으면 위의 배포 스큐 검사(409), 있으면 버전 정책 기반 업그레이드 게이트(426).
브라우저 클라이언트는 `X-Platform`을 보내지 않으므로 서로 간섭하지 않습니다.

### 헬스체크

- `GET /api/health/live` — 프로세스 생존 (의존성 안 봄)
- `GET /api/health/ready` — DB 연결 여부 구분(`db: up|down`), 종료 중이면 503

### CORS

허용 origin은 `CORS_ORIGINS` 환경 변수(콤마 구분)로만 제어합니다. 와일드카드 없음,
암묵적 허용 없음 (`src/server/http/cors.ts`).

### i18n

`@shared/i18n` 파사드를 서버(에러 메시지 — `Accept-Language`/`?lang=` 협상)와
클라이언트(UI 문자열 — 로케일 컨텍스트)가 공유합니다. 로케일 추가는 카탈로그 파일
하나 + 등록 한 줄입니다. DB에는 로케일 독립적인 데이터만 저장합니다.

## 클라이언트

- **API 카탈로그**: 모든 엔드포인트는 `src/client/api/endpoints.ts` 한 곳에 상세 주석과
  함께 정의됩니다. 컴포넌트는 `fetch`를 직접 부르지 않고 이 카탈로그(또는 그 위의
  TanStack Query 훅 `queries.ts`)만 사용합니다.
- **TanStack Query**: 목록 조회는 로딩/에러(재시도 버튼)/데이터/빈 상태를 모두 처리하고,
  mutation은 성공 시 목록 캐시를 invalidate합니다. 상태 토글은 **optimistic update**
  (스냅샷 → 즉시 반영 → 실패 시 롤백 → settle 시 재동기화)로 구현되어 있습니다.
- **최소 상태**: 페이지/필터/정렬은 URL 쿼리에서 파생, 서버 데이터는 쿼리 캐시에만 존재.
  로컬 `useState`는 "아직 제출 안 된 폼 입력"뿐입니다.
- **라우팅**: react-router (BrowserRouter). 서버의 SPA 캐치올이 딥링크를 지원합니다.
- **디자인 시스템**: 토큰 3계층(원시 → 디자인 치수 → 시맨틱 컬러)으로 구성되며
  `/design-system` 페이지에서 전부 확인할 수 있습니다. `<html>`의 `data-theme`
  (light/dark)와 `data-design`(A=심미성/B=시인성) 속성만으로 전환됩니다 — 헤더의 토글
  버튼으로 즉시 스위칭됩니다. 아이콘은 lucide-react.
- **UI 자동화 / 접근성**: 모든 인터랙티브 컴포넌트는 `testId`가 **필수 prop**이며 값은
  `src/client/testing/testids.ts` 레지스트리에서만 나옵니다. WAI-ARIA(라벨, live region,
  `aria-busy`, `aria-current`, skip link, 네이티브 컨트롤 우선)를 준수합니다.
  전체 규약은 **[docs/ui-automation.md](docs/ui-automation.md)** 한 문서에서 확인하세요.

## 모바일 앱 레이어 (`apps/mobile`)

### 이 레이어의 원칙 — 원본 보일러플레이트 위에 "쌓기"

앱 지원을 위해 원본 구조를 재배치하지 않았습니다. `src/{client,server,shared}`는 그대로
있고, 앱은 워크스페이스 하나(`apps/mobile`)로 추가되며, 서버·공통 코드에는 **기존 동작을
바꾸지 않는 추가분만** 얹혀 있습니다. 덕분에 업스트림 보일러플레이트의 변경사항을 이
저장소에 계속 머지할 수 있습니다.

구체적인 규칙:

- **파일 추가 > 파일 수정**: 새 스키마는 `migrations/0002_mobile.sql`(0001은 손대지 않음),
  커서 페이지네이션은 `@shared/api/cursor-pagination`(기존 `pagination`은 유지),
  앱 UI 문자열은 `apps/mobile/src/i18n/messages`(공통 카탈로그는 서버가 쓰는 에러 메시지만).
- **기존 계약 불변**: 웹 클라이언트가 쓰는 `Page<T>` 응답, `X-App-Version` 스큐 검사,
  기존 라우트/테스트는 그대로입니다. 앱용 동작은 앱만 보내는 신호(`X-Platform`, `limit`)로
  분기합니다.
- **앱은 `src/shared`를 소스 그대로 import**합니다(`@shared/*` 별칭 — tsconfig `paths`와
  `metro.config.js`가 같은 매핑을 공유). 서버와 앱이 문자 그대로 같은 계약 파일을 씁니다.
- 업스트림 머지 후에는 `bun run check` 한 번으로 웹·서버·앱 전체가 검증됩니다.

### 앱이 제공하는 것

- **부트 시퀀스**(`src/boot`): 명시적 상태 머신 — 원격 설정 로드 → 버전 정책 판정 →
  (설정으로 켜지는) 광고 슬롯 게이트(min-show/skip/timeout) → 진입. 광고나 네트워크가
  앱 진입을 **영구히 막지 못하도록** 타임아웃이 구조적으로 보장됩니다.
- **업데이트 3경로**(`src/version`, `@shared/domain/version-policy`): `minSupportedVersion`
  미만이면 전체 화면 강제 업데이트, 그 외에는 OTA/스토어 선택 업데이트 프롬프트("나중에"는
  해당 버전에 한해 3일 억제). 판단 로직은 순수 함수라 단위 테스트로 고정되어 있습니다.
  운영 절차는 **[docs/release-playbook.md](docs/release-playbook.md)**.
- **원격 설정**(`GET /api/app-config`): `revision`이 곧 ETag → 폴링은 대부분 304이고,
  변경은 WebSocket으로 즉시 push됩니다. 점검 모드(kill switch), 공지 배너, 기능 플래그,
  부트 광고, 폴링 주기가 여기서 제어됩니다. 잘못된 값 하나가 앱을 벽돌로 만들지 않도록
  키별로 독립 검증 후 기본값으로 폴백합니다.
- **오프라인**: TanStack Query 캐시를 디스크에 영속화하고, 목록은 무한 스크롤 +
  optimistic mutation. 네트워크 상태 배너를 제공합니다.
- **푸시**: 기기 토큰 등록(`/api/push-tokens`) + 관리자 브로드캐스트
  (`/api/admin/push/broadcast` → 워커가 발송). 발송은 `PUSH_DRIVER=dry-run`이 기본이라
  **자격 증명 없이도 파이프라인 전체가 동작**합니다.
- **관리자 API**: 버전 정책·원격 설정·푸시 브로드캐스트는 `ADMIN_TOKEN` 베어러 토큰으로만
  접근 가능하며, 토큰이 비어 있으면 관리자 API는 완전히 비활성입니다.
- **플랫폼 분기 정책**: 통합이 기본, 분기는 기록을 남기고 `*.ios.ts`/`*.android.ts`로 —
  **[docs/platform-decisions.md](docs/platform-decisions.md)**.
- **UI 자동화**: testID 레지스트리 + Maestro 플로우 —
  **[docs/ui-automation-mobile.md](docs/ui-automation-mobile.md)**.
- **음성 어시스턴트**(`src/shared/voice`, `apps/mobile/src/voice`, `capsule/`):
  Siri·Bixby·Google Assistant 세 진입점은 플랫폼 API가 서로 무관해 분리가 불가피하지만,
  **어떤 동작이 있고 사용자가 뭐라고 말하는지는 카탈로그 하나**로 모으고 네이티브
  산출물을 거기서 생성합니다(`bun run voice:generate`, `voice:check`가 `check`에 포함).
  실행은 두 모드 중 하나 — 앱을 여는 `deeplink`(RN 핸들러 한 곳)와, 앱을 열지 않고
  서버가 답을 말해주는 `api`(`POST /api/voice/:id`). 운전 중 핸즈프리가 설계 기준입니다.
  **[docs/voice-assistant.md](docs/voice-assistant.md)**.

### 앱 개발 시작

```bash
bun run dev               # API 서버 (앱이 붙을 대상)
bun run dev:mobile        # Expo 개발 서버
```

기기/시뮬레이터에서 API 주소는 `apps/mobile/src/config/env.ts`가 플랫폼별로 결정하며
(`EXPO_PUBLIC_API_URL`로 항상 덮어쓸 수 있음), 환경(dev/stg/prod)은 `APP_ENV` 하나로
번들 ID까지 분리됩니다(`app.config.ts`). 네이티브 빌드는 CI에서 분리되어 있습니다
(`.github/workflows/native-build.yml`, EAS).

> 앱 번들은 **공개 산출물**입니다. 비밀값은 서버에만 두고, 앱이 비밀값을 필요로 하는 일은
> 서버가 대신 수행합니다.

## CI / DX

- **GitHub Actions** (`.github/workflows/ci.yml`): 모든 push마다
  prettier → eslint → tsc(웹·앱) → knip → test → build. 네이티브 빌드는 느리고
  서명 자격 증명이 필요하므로 `native-build.yml`(수동/태그 트리거)로 분리했습니다.
- **husky + lint-staged**: pre-commit에 staged 파일 lint/format, pre-push에
  `bun run check` 전체 게이트.
- **빌드**: Bun 번들러 단독 사용. `bun run build` 한 번으로 서버+클라이언트+마이그레이터가
  `dist/`에 떨어집니다. 개발 모드는 Bun의 HTML import 기반 HMR.
- **Docker**:
  - DB만: `bun run db:up` (redis 포함: `docker compose --profile redis up -d`)
  - 컨테이너 안에서 빌드까지: `docker compose --profile app up --build`
    (멀티스테이지 Dockerfile — 런타임 이미지에는 빌드 산출물만 포함)

## GraphQL을 도입한다면 (가이드)

이 보일러플레이트는 REST 기반이지만, GraphQL을 붙일 경우 **persisted query** 방식을
따르세요: 앱 안에 정의된 각 쿼리의 핑거프린트(해시)를 빌드 시 저장해 두고, 일반
사용자 토큰은 등록된 해시의 쿼리만 실행할 수 있게 하며, 임의 쿼리는 관리자 토큰에만
허용합니다. 버전 핸드셰이크(`X-App-Version`)와 동일하게 빌드 시점 주입 패턴을 재사용할
수 있습니다.

## 테스트 전략

- **단위**: 비즈니스 로직(`TodoService`, `VersionPolicyService`, `AppConfigService`,
  `PushTokenService`) — 트랜잭션 롤백, 이벤트 발행, 캐시, 성공/실패 케이스. 공통 계약의
  순수 함수(semver, 커서 인코딩, 업데이트 판정, 원격 설정 파싱)도 여기서 고정됩니다.
- **통합**: 실제 앱을 임시 포트에 띄워 HTTP로 검증 — CRUD, 두 페이지네이션 모드,
  검증 실패(400)와 로컬라이즈된 메시지, 404, 배포 스큐(409), 업그레이드 게이트(426),
  원격 설정 ETag/304 + WS push, 관리자 인증(401), 푸시 브로드캐스트, CORS, 헬스체크.
- **앱 로직**: API 클라이언트(헤더·에러 매핑), 부트 상태 머신, 원격 설정 스토어는
  UI 없이 순수 로직으로 테스트됩니다. 화면 단위 플로우는 Maestro(E2E)가 담당합니다.
- 전부 in-memory 드라이버로 돌므로 **`bun test` 하나로, 외부 환경 없이** 실행됩니다.
