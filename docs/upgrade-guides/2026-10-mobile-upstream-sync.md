# 업스트림 업데이트 적용: 모바일 동기화 — 오버레이 · 인증 · 채팅 (2026-10)

이 저장소(boilerplate-mobile)에서 출발한 다운스트림에서 일하는 AI 에이전트를 위한 적용 절차입니다.
boilerplate의 #7~#19를 앱 쪽에 반영한 묶음이며, **머지만으로 끝나지 않는 것만** 적습니다. 웹·서버 쪽 절차는
[2026-09 채팅 · React 프로덕션 빌드 · React Compiler](2026-09-chat-react-compiler.md)를 이어서 따릅니다.

| PR                                                          | 내용                                                    | 머지 순서 |
| ----------------------------------------------------------- | ------------------------------------------------------- | --------- |
| [#6](https://github.com/hwahee/boilerplate-mobile/pull/6)   | Bun·Node 고정 (upstream #7)                             | 1         |
| [#7](https://github.com/hwahee/boilerplate-mobile/pull/7)   | 오버레이(Modal/BottomSheet/Sidebar), ScrollBox (#8, #9) | 2         |
| [#8](https://github.com/hwahee/boilerplate-mobile/pull/8)   | Bun 1.4.2, 의존성 업데이트 (#10~#12)                    | 3         |
| [#9](https://github.com/hwahee/boilerplate-mobile/pull/9)   | 회원 인증, React Compiler 빌드, `1001_mobile` (#13~#18) | 4         |
| [#10](https://github.com/hwahee/boilerplate-mobile/pull/10) | 채팅 (#19)                                              | 5         |

## 0. 작업 원칙

- 다운스트림의 `CLAUDE.md`가 이 저장소와 다르면 다운스트림 것이 우선입니다.
- **3절의 결정 항목은 에이전트가 정하지 않습니다.** 답을 받기 전에는 기본값으로 둡니다.
- Bun은 **1.4.2 이상**이어야 합니다.

## 1. 이미 적용됐는지 확인

| 확인                                                               | 적용됨의 의미          |
| ------------------------------------------------------------------ | ---------------------- |
| `ls apps/mobile/src/components/overlay/index.ts`                   | #7 (앱 오버레이)       |
| `ls migrations/1001_mobile.sql`                                    | #9의 마이그레이션 번호 |
| 각 DB에서 `SELECT * FROM schema_migrations WHERE version = '1001'` | 4.1을 그 DB에 적용함   |

## 2. 충돌 해결

| 파일                                     | 해결 원칙                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `migrations/0002_mobile.sql`             | 이름 바꾸기(`1001_mobile.sql`)를 그대로 받습니다. 다운스트림이 이 파일을 고쳤다면 고친 내용을 새 이름에 옮깁니다. |
| `eslint.config.js`                       | 앱 블록(`apps/mobile/**`)에 오버레이 경계 패턴이 더해졌습니다. 다운스트림 패턴과 **한 목록에** 합칩니다.          |
| `apps/mobile/src/theme/*`, `Palette.tsx` | 오버레이 토큰(`tokens.overlay`)이 추가되고 Palette의 임시 시트가 사라졌습니다.                                    |
| 서버 파일                                | 2026-09 가이드의 2절을 따릅니다.                                                                                  |

검증: `bun install && bun run check`

## 3. 사람에게 확인할 결정

1. **앱 로그인 화면.** 앱에는 아직 로그인 화면이 없습니다. `AUTH_DRIVER=dev`(`.env.example`의 값)에서는 앱의 todo
   쓰기가 401이 됩니다. 기본값: 만들지 않음(앱 개발 시 `AUTH_DRIVER=none`).
2. **앱 채팅 화면.** 서버 기능은 준비되어 있지만 앱 화면은 없습니다(README "채팅 > 모바일 앱"). 기본값: 만들지 않음.
3. **앱에 React Compiler 적용.** 웹 배포 빌드에만 적용되고, 앱(Metro)에는 적용되지 않습니다. Expo의
   `babel-preset-expo`로 켤 수 있지만 검증하지 않았습니다. 기본값: 끔(앱 `.tsx`는 지금처럼 memo를 직접 씀).
4. 2026-09 가이드 3절의 결정 항목.

## 4. PR별 조치

### 4.1 #9 — 마이그레이션 번호 (`0002_mobile` → `1001_mobile`)

업스트림의 `0002_users`와 번호가 겹쳐서 앱 마이그레이션을 1000번대로 옮겼습니다. 업데이트된 러너는 기록된 이름과
파일 이름이 다르면 멈추므로, **`0002_mobile`을 이미 적용한 모든 DB**에서 새 서버를 띄우기 전에 기록을 옮깁니다.
러너의 오류 메시지는 `0002_users`의 번호를 바꾸라고 안내하지만, 이 경우에는 따르지 않습니다.

```sql
UPDATE schema_migrations
   SET version = '1001', name = '1001_mobile'
 WHERE version = '0002' AND name = '0002_mobile';
```

그다음 `bun run db:migrate`(컨테이너: `bun migrate.js`)로 `0002_users`, `0003_chat`을 적용합니다. 데이터는 그대로입니다.
로컬 DB라면 `docker compose down -v && bun run db:setup`으로 다시 만들어도 됩니다.

다운스트림이 자기 마이그레이션을 더할 때는 업스트림(0000번대)·이 저장소(1000번대)와 겹치지 않는 번호대를 씁니다(예: 2000번대).

검증: `bun run db:migrate`가 오류 없이 끝나고, `schema_migrations`에 `0002_users`, `0003_chat`, `1001_mobile`이 있음.

### 4.2 #7 — 앱 오버레이

1. 앱에서 RN `Modal`을 직접 쓰는 곳을 `useOverlay()`로 옮깁니다. iOS에서는 형제 Modal이 쌓이지 않아서, 오버레이와
   동시에 뜨면 충돌합니다. `grep -rn "Modal" apps/mobile/src --include=*.tsx | grep "react-native"`
2. 앱 루트가 `<OverlayProvider>`로 감싸져 있어야 합니다(`App.tsx`).
3. 선언형(`declarative.tsx`)을 쓰는 곳은 ESLint 예외 주석에 이유를 적습니다. 상세: [overlay-mobile.md](../overlay-mobile.md)

### 4.3 #9 — 인증과 앱

- 앱 개발 환경의 `.env`를 확인합니다. 앱으로 쓰기 기능을 개발한다면 `AUTH_DRIVER=none`입니다.
- 음성 인텐트(`/api/voice/*`)는 `VOICE_TOKEN`으로 인증하므로 영향이 없습니다.

## 5. 완료 조건

- [ ] `bun run check` 통과, `apps/mobile`에서 `bunx expo export` 통과
- [ ] `0002_mobile`을 적용한 모든 DB에 4.1 적용, 배포 절차에 "기록 옮기기 → 마이그레이션 → 새 서버" 순서가 들어감
- [ ] 앱에 RN `Modal` 직접 사용이 남지 않음
- [ ] 2026-09 가이드의 완료 조건
- [ ] 3절의 결정 항목에 대해 사람의 답을 받았거나, 기본값으로 둔 것을 알림

## 6. 되돌리기

- 마이그레이션 번호: 4.1의 `UPDATE`를 반대로 돌리면 기록이 돌아가지만, 그 뒤에 적용된 `0002_users`와 번호가 다시 겹칩니다.
  번호는 되돌리지 않는 것을 원칙으로 합니다.
