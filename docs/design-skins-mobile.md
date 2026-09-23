# 디자인 스킨 이식 — office / kids / Accordion (웹 → 앱)

원본 보일러플레이트의 PR #2(office 스킨), PR #3(kids 스킨), `4b0c30e`(디자인 순환 수정),
PR #4(아코디언)는 **웹 코드로는 이미 이 저장소에 머지되어 있었지만** 앱(`apps/mobile`)에는
반영되지 않았습니다. 앱은 디자인 A/B만 알고 있었습니다. 이 문서는 그 공백을 메운 이식의
기준과 결과를 기록합니다.

| 스킨   | 이식 수준                                                                      |
| ------ | ------------------------------------------------------------------------------ |
| office | **웹 구현과 동일** — 토큰 값과 스킨 규칙을 그대로 옮기고, 테스트로 일치를 강제 |
| kids   | **베타** — 토큰은 동일, 인터랙션은 터치에 대응되는 것만 이식(§4)               |

---

## 1. 원칙

1. **값은 복사하고, 다시 디자인하지 않는다.** office/kids의 토큰은 웹
   `src/client/styles/tokens.css`의 값을 그대로 옮겼습니다. 단위는 `1rem = 16pt`,
   `px = pt`입니다(휴대폰 브라우저의 CSS px와 RN의 pt는 같은 논리 단위).
2. **일치는 테스트가 강제한다.** `apps/mobile/src/theme/tokens.test.ts`는 웹의 `tokens.css`를
   **직접 파싱해서** 앱 토큰과 비교합니다. 숫자를 테스트에 복사해 두지 않았으므로, 업스트림이
   스킨 값을 바꾸면 앱이 따라갈 때까지 `bun run check`가 실패합니다.
3. **A/B는 건드리지 않는다.** A/B는 원래 앱 전용 값(웹과 다름)을 쓰고 있었고, 이번 작업
   이후에도 렌더링 결과가 바뀌지 않습니다. 스킨 규칙 함수는 A/B에 대해 항상 빈 객체를
   반환하며, 이 역시 테스트(`skin.test.ts`)로 고정되어 있습니다.
4. **의존성 추가 없음.** 베벨·그라디언트·그림자·아웃라인은 RN 0.81(New Architecture)이
   기본 제공하는 스타일 속성으로 그립니다.

## 2. 구조 — 웹의 CSS 계층을 앱에 대응시키기

| 웹                                                  | 앱                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `tokens.css` — `[data-design]` 치수/모션 블록       | `theme/tokens.ts` — `getTokens(variant, scheme, platform)`                              |
| `tokens.css` — `[data-design][data-theme]` 색 블록  | 같은 파일의 `OFFICE_COLORS` / `KIDS_COLORS` / `OFFICE_BEVEL`                            |
| `main.css` — `[data-design='office'] .btn { … }` 등 | `theme/skin.ts` — `buttonSkin` / `fieldSkin` / `cardSkin` / `accordionSkin` (순수 함수) |
| `--duration-fast` + `--ease-interaction` transition | `theme/motion.ts` — `useMotionProgress()` (스킨이 시간·곡선을 결정)                     |
| `prefers-reduced-motion`                            | `useTheme().reduceMotion` (OS "동작 줄이기" 설정을 구독)                                |
| `<html data-design>` + `localStorage`               | `ThemeProvider` + `kv-store` (`app.designVariant`)                                      |

토큰에 새로 생긴 의미 단위:

| 토큰                          | 뜻                                                   | A/B 값                     |
| ----------------------------- | ---------------------------------------------------- | -------------------------- |
| `radius.control/surface/pill` | 버튼·입력 / 카드 / 배지·칩의 모서리                  | 기존 `md` / `lg` / `full`  |
| `controlHeight`, `chipHeight` | **보이는** 컨트롤/칩 높이                            | 기존 `minTouchTarget`(-8)  |
| `controlPaddingX`             | 컨트롤 좌우 여백                                     | 기존 `spacing.md`          |
| `type.fontFamily/lineHeight`  | 스킨 글꼴, CSS line-height 배수                      | 없음(플랫폼 기본)          |
| `surfaceShadow`               | 카드 그림자(CSS box-shadow 문자열)                   | 없음                       |
| `motion.*`                    | 지속 시간·곡선·press/focus 배율·체크 팝              | 웹 기본값(150/240ms, ease) |
| `bevel`                       | office 베벨 색(`--office-bevel-*`, `--office-btn-*`) | `null`                     |
| `colors.focus`                | 포커스 링 색(`--color-focus`)                        | primary와 같은 값          |

## 3. office — 웹 규칙과 앱 구현 대응표

| 웹 규칙(`main.css` / `tokens.css`)                                | 앱 구현                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| 색 팔레트(Luna 실버 / 그래파이트) 전부                            | `OFFICE_COLORS` (테스트로 일치 검증)                                 |
| 글자 크기 11/13/16/18/22px, 제목 700, line-height 1.4             | `type` caption 11 / body 13 / heading 18 / title 22, lineHeight 1.4  |
| `--control-height: 1.75rem`, padding-x `--space-2`                | `controlHeight: 28`, `controlPaddingX: 8`                            |
| `--radius-control/surface: 2px`, `.badge { border-radius: 2px }`  | `radius.control/surface/pill = 2`                                    |
| `--duration-fast/expand: 0s` (모션 없음)                          | `motion.durationFast/Expand = 0` → 모든 전환이 즉시                  |
| `.btn`: 1px 볼록 베벨(좌상 밝음, 우하 어두움), 글꼴 굵기 400      | `buttonSkin` → `bevelBorder('raised')`, `labelWeight: '400'`         |
| `.btn--secondary/ghost`: 버튼 면 그라디언트, 글자색 text          | `experimental_backgroundImage: linear-gradient(faceTop, faceBottom)` |
| `.btn--primary`: `color-mix(primary 72%, white)` → primary        | `mixSrgb(primary, white, 0.72)` → primary 그라디언트                 |
| `.btn:active`: 베벨 반전 + `translate(1px, 1px)` (박스 크기 불변) | 눌림 상태에서 `bevelBorder('sunken')` + `translateX/Y: 1`            |
| `.btn:disabled`: opacity .55                                      | `opacity: 0.55`                                                      |
| `.field__input`: 1px 오목 베벨, radius 1px                        | `fieldSkin` → `bevelBorder('sunken')`, `borderRadius: 1`             |
| `:focus-visible`: 1px 점선 사각형, offset 1px                     | 포커스된 입력에 `outlineStyle: 'dotted'`, width 1, offset 1          |
| `.card`: 볼록 그룹 박스 베벨                                      | `cardSkin` → `bevelBorder('raised')`                                 |
| `.accordion__trigger`: 버튼 면 그라디언트, 항목 구분선 bevel-dark | `accordionSkin` → 면 그라디언트, `separatorColor: bevel.dark`        |
| 글꼴 `'Segoe UI', Tahoma, Geneva, Verdana, …`                     | 아래 "글꼴" 참고                                                     |

**글꼴.** 웹 글꼴 스택을 **각 휴대폰에 실제로 설치된 첫 글꼴**로 풀었습니다. 휴대폰
브라우저에서 웹 office 스킨을 열면 렌더링되는 글꼴과 같습니다.

- iOS: Segoe UI·Tahoma·Geneva 없음 → **Verdana**(iOS 기본 탑재)
- Android: 스택의 어떤 글꼴도 없음 → 시스템 sans-serif

Segoe UI/Tahoma는 Microsoft 라이선스 글꼴이라 앱에 번들할 수 없습니다. 플랫폼별 분기는
`ThemeProvider` 한 곳에만 있습니다([platform-decisions.md](./platform-decisions.md) #5).

**터치 영역.** 28pt 컨트롤은 iOS/Android 최소 터치 크기(44pt)보다 작습니다. 모양은 웹과
같게 유지하고, 모자란 만큼 `hitSlop`으로 터치 영역만 넓혔습니다(`touchSlop()`). 화면에는
보이지 않습니다.

**웹 동작을 그대로 따른 부분(의도적).** 웹에서는 `[data-design='office'] .field__input`
규칙이 `.field__input[aria-invalid='true']`보다 뒤에 있어서, office에서는 **오류가 있는 입력도
빨간 테두리가 아니라 오목 베벨을 유지**합니다(오류 메시지는 표시됨). 앱도 같게
구현했습니다. 웹 쪽 버그라고 판단되면 업스트림에서 고친 뒤 앱을 따라가게 하는 것이 순서입니다.

**터치 화면에 대응물이 없는 규칙.** 아래 규칙은 마우스 호버나 키보드 포커스에만 반응하므로
휴대폰(휴대폰 브라우저 포함)에서는 웹에서도 보이지 않습니다. 앱에도 넣지 않았습니다.

- `.btn:hover`, `.accordion__trigger:hover`의 밝아지는 그라디언트
- `.app-nav a:hover` 메뉴 바 하이라이트
- 버튼의 `:focus-visible` 점선 사각형(키보드 포커스 전용 — 입력 필드는 적용함)

## 4. kids (베타)

| 웹 규칙                                                                             | 앱                                                                | 상태        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- |
| 색 팔레트, 크기(15/17/30/40), 굵기 800, 알약 모양, 3px 테두리                       | 토큰 그대로                                                       | 이식        |
| 카드 스티커 그림자 `0 6px 0 …, 0 14px 26px …`                                       | `boxShadow` 문자열 그대로                                         | 이식        |
| `.btn` 그림자 `0 5px 0`, `:active` → `translateY(2px) scale(.9)` + 그림자 `0 1px 0` | 눌림 시 같은 변형을 스프링 곡선으로 애니메이션                    | 이식        |
| 입력 포커스: `scale(1.04)` 팝 + 5px 글로우 + 4px 포커스 링                          | 같은 배율을 overshoot 곡선으로, 글로우·링은 `boxShadow`/`outline` | 이식(근사)  |
| 체크박스 체크 시 팝(`kids-check-pop` 키프레임)                                      | `CheckPop` — 할 일 토글 아이콘에 같은 키프레임                    | 이식        |
| 아코디언 380ms 스프링 펼침, 트리거 굵기 800                                         | LayoutAnimation `spring` + 800                                    | 이식(근사)  |
| 글꼴 `'Baloo 2', 'Comic Sans MS', 'Chalkboard SE', …`                               | iOS: Chalkboard SE / Android: 시스템 글꼴                         | 플랫폼 한계 |
| 버튼·카드·할 일 행의 hover 들썩임/기울임, 내비게이션 흔들림                         | —                                                                 | 호버 없음   |
| 스피너 회전 속도 변경                                                               | — (`ActivityIndicator`는 속도를 조절할 수 없음)                   | 미이식      |

"근사"라고 표시한 항목:

- 입력 팝: 웹 키프레임은 1 → 1.10 → 1.04인데, 앱은 overshoot 곡선 하나로 1 → 약 1.05 → 1.04입니다.
- 아코디언: CSS `cubic-bezier(0.34, 1.8, 0.5, 1)`을 네이티브 스프링(`springDamping 0.55`)으로 옮겼습니다.

모든 변형 애니메이션은 웹처럼 OS의 "동작 줄이기" 설정이 켜져 있으면 꺼집니다.

## 5. Accordion (PR #4)

`apps/mobile/src/components/Accordion.tsx`는 웹 `src/client/ui/accordion.tsx`와 같은 props
(`items`, `mode`, `defaultOpenIds`)를 받고, 같은 testID 파생 규칙과 같은 세 가지 탈출구를
가집니다. 앱에서는 prop 이름만 `testID`입니다.

| 웹 탈출구                                                 | 앱 구현                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| #0 grid-rows 0fr→1fr 애니메이션(`--duration-expand`)      | `LayoutAnimation`(`motion.durationExpand`). office 0 → 즉시, kids → 스프링 |
| #1 누른 트리거를 제자리에 고정(프레임마다 스크롤 보정)    | 커밋된 최종 레이아웃으로 이동량을 한 번 계산해 스크롤 보정                 |
| #2 잘린 패널 드러내기(트리거가 화면을 벗어나지 않는 한도) | #1과 합쳐 한 번의 스크롤로 처리(`planAccordionScroll`, 단위 테스트 있음)   |

#1·#2는 스크롤 위치를 바꿔야 하므로 `<AnchoredScrollView>` 안에서만 동작합니다(디자인
시스템 화면이 이를 사용). 그 밖의 곳에서는 보정 없이 열리고 닫히기만 합니다.

웹과 다른 점:

- 방향키 로빙 포커스가 없습니다. 스크린 리더는 스와이프 순서로 이동합니다.
- 닫힌 패널은 즉시 접근성 트리에서 빠집니다. 앱에서는 이것이 화면 표시에 영향을 주지 않으므로 애니메이션을 기다릴 필요가 없습니다.

## 6. 검증

- 자동: `bun run check`
  - `tokens.test.ts`: 웹 CSS를 파싱해 office·kids의 색·크기·모션·베벨이 같은지 비교
  - `skin.test.ts`: 스킨 규칙과 A/B 불변 확인
  - `accordion-scroll.test.ts`: 스크롤 보정 계산
- 번들: `expo export --platform android`로 Hermes 번들 생성까지 확인했습니다.
- **실기기·시뮬레이터 시각 확인은 아직 하지 않았습니다.** 다음 항목을 확인해야 합니다.
  - [ ] office 라이트/다크: 버튼 베벨과 눌림(1px 이동), 그라디언트, 입력 점선 포커스
  - [ ] kids 라이트/다크: 버튼 눌림 스프링, 입력 팝·글로우, 카드 그림자, 체크 팝
  - [ ] 아코디언: office는 즉시 토글, kids는 스프링. single 모드에서 트리거가 고정되는지
  - [ ] iOS Verdana / Chalkboard SE 글꼴 적용, Android 시스템 글꼴
  - [ ] Maestro: `apps/mobile/e2e/settings-theme-design.yaml`
