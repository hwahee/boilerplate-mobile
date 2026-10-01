# 오버레이 — 앱 이식 결정 (Modal / BottomSheet / Sidebar)

upstream PR #8(오버레이, 설계: [overlay-design.md](./overlay-design.md))과 #9(스크롤 박스)를
앱(`apps/mobile/src/components/overlay`)에 옮기며 내린 결정입니다. 웹 설계의 원칙은
**그대로 따르고**, 여기에는 React Native라서 달라진 부분만 적습니다. 웹 원칙은 다음과 같습니다.

- 전역 자원은 스택이 소유하고, 컴포넌트는 선언만 합니다.
- 닫기는 트랜잭션입니다.
- 명령형 문을 기본으로 쓰고, 선언형 문은 예비입니다.
- 계약(`title`/`testID` 필수)은 선언형 props 한 곳에서만 정의합니다.

> 요약: **네이티브 레이어 하나(RN `Modal`)에 스택 전체를 그립니다.** scrim은 그중 맨 위
> 하나만 칠하고, Android 뒤로가기도 맨 위 하나만 닫습니다(LIFO). 이 규칙은 순수 함수로
> 계산하며 테스트가 있습니다.

---

## 1. 웹 → 앱 대응

| 웹 (`<dialog>.showModal()` 기반)                        | 앱                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| top layer — z-index 없이 쌓임, 조상에 잘리지 않음       | **호스트 Modal 하나** 안에 스택 순서대로 그림 (§2)                                                       |
| scrim: `data-overlay-top`인 것만 `::backdrop` 칠함      | scrim 컴포넌트 **하나**를 맨 위 active 항목 바로 아래에 둠                                               |
| body 스크롤 잠금(누적 자원)                             | 호스트 레이어 유지(누적 자원) — 닫히는 중인 항목이 있어도 유지                                           |
| ESC: 플랫폼이 LIFO로 하나씩                             | Android 뒤로가기: 스택이 계산한 맨 위 하나만 (`onRequestClose`)                                          |
| `inert` + 포커스 트랩                                   | 네이티브 Modal이 앱을 가림 + 맨 위 패널만 `accessibilityViewIsModal`, 아래는 숨김                        |
| 열 때 패널에 포커스 → 제목부터 읽음                     | 제목에 접근성 포커스(`sendAccessibilityEvent('focus')`)                                                  |
| CSS 전환 + `transitionSettleMs()` 실측                  | `Animated` + 스킨 토큰(`motion.durationFast`/`easing`). office 즉시, kids overshoot, 동작 줄이기 시 즉시 |
| 닫기 트랜잭션: `onClose` 요청 → 애니메이션 → `onClosed` | 같음. 닫는 도중 다시 열면 애니메이션이 멈추고 `onClosed`는 호출되지 않음(§4.4)                           |
| 백드롭 클릭: 패널 안에서 시작한 드래그는 무시           | RN `Pressable`은 누르기가 scrim에서 **시작**해야만 반응 — 별도 가드 불필요                               |
| dev 런타임 검사(패널 안 testid 누락·자체 레이어)        | **없음** — RN에는 DOM 질의가 없습니다. 껍데기 계약은 타입과 린트가 그대로 강제                           |
| `.scroll-box`(#9) — bleed + 비례 성장 무력화            | `ScrollBox` — 같은 bleed, 비례 성장(scale-up 팝)은 컨텍스트로 끔 (§5)                                    |

토큰(`--overlay-width-*`, `--sheet-max-height`, `--sidebar-width`, `--scroll-bleed`, 스킨별
`--overlay-scrim`)은 웹 값을 그대로 옮겼습니다. `tokens.test.ts`가 웹 CSS를 파싱해 일치하는지
검증합니다. 웹 오버레이 CSS는 스킨 전용 규칙 없이 토큰만 쓰므로, office와 kids의 모양은
토큰에서 자동으로 따라옵니다.

## 2. 결정: 네이티브 레이어는 하나

iOS(Fabric)의 RN `Modal`은 **자기를 소유한 view controller에서** present됩니다
(`RCTModalHostViewComponentView` → `[self reactViewController]`). 그래서 **형제** Modal 두 개는
쌓이지 않습니다. 두 번째 Modal은 이미 무언가를 present 중인 루트 controller를 만나 실패합니다.
JSX에서 Modal을 서로 안에 중첩하면 피할 수는 있지만, 그러면 "누가 누구 안에 있는가"를
호출부가 알아야 하므로 §2의 원칙(호출부는 선언만 한다)이 무너집니다.

그래서 호스트(`internal/host.tsx`)가 **스택에 항목이 하나라도 있는 동안 투명한 Modal 하나를
present하고, 모든 오버레이를 그 안에 순서대로 그립니다.** 웹의 "스택이 top layer를 소유한다"를
앱에서 구현한 방식입니다. 이 덕분에 다음 두 가지도 얻습니다.

- **z-index 없이 쌓입니다.** 웹의 회수 판정 기준 1번과 같습니다.
- **scrim과 뒤로가기를 처리하는 곳이 하나입니다.**

같은 이유로 **앱의 다른 RN Modal도 이 스택으로 옮겼습니다.** 선택 업데이트 프롬프트
(`version/UpdateGate.tsx`)가 자기 Modal을 갖고 있으면, 사용자가 연 오버레이와 동시에 떠서
충돌할 수 있었습니다. 이제는 선언형 `BottomSheet`(진행률을 계속 갱신하므로 case 2)입니다.
앞으로 RN `Modal`을 직접 쓰지 말고 `useOverlay()`를 쓰세요.

## 3. 두 개의 문

**명령형 `useOverlay()`**: 기본입니다. 웹과 같습니다.

- `title`·`testID`는 필수 인자입니다.
- Promise는 reject되지 않고, 닫으면 `undefined`로 resolve됩니다.
- resolve는 퇴장 애니메이션이 끝난 뒤에 됩니다.
- 오버레이를 연 컴포넌트가 언마운트되면 그 컴포넌트가 연 것도 자동으로 닫힙니다.
- 한 번 답한 값은 나중의 `close()`가 덮어쓰지 않습니다.

**선언형 `declarative.tsx`**: opt-in이며, ESLint 경계로 막혀 있습니다. 웹의 세 가지 경우 중 **두 가지만** 성립합니다.

| 웹의 경우                                     | 앱                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. 호출한 위치의 **서브트리 컨텍스트**가 필요 | **불가.** RN에는 포털이 없어서 선언형도 앱 루트의 호스트가 그립니다. 루트 컨텍스트만 보이므로 필요한 값은 props로 넘기세요      |
| 2. 내용물이 **계속 갱신**됨                   | 가능. 매 렌더마다 호스트에 다시 등록하며, layout effect라 입력값이 한 프레임 늦지 않습니다. 예: Palette 시트, 업데이트 프롬프트 |
| 3. 항상 보이는 **레이아웃**(inline 사이드바)  | 가능. `Sidebar modality="inline"`은 호스트를 거치지 않고 제자리에 그립니다                                                      |

`Sidebar`의 `modality="auto"`는 **항상 modal**입니다. 지원 기기가 휴대폰뿐이라 웹의 768px 이상
도킹 레이아웃에 해당하는 경우가 없습니다([platform-decisions.md](./platform-decisions.md) #3).

## 4. 최신 upstream 반영 — #12(도킹 사이드바)

upstream #12는 웹의 도킹(inline) 사이드바가 drawer의 닫힘 상태 transform을 물려받아 한 폭만큼
밀려나던 버그를 고쳤습니다. 원인은 `<aside>`에는 `open` 속성이 없다는 점이었습니다. 앱에서는
처음부터 **inline과 drawer를 다른 컴포넌트로 분리**했습니다(`internal/InlineSidebar.tsx`). 그래서
두 표현이 공유하는 닫힘 상태 규칙이 없고, 같은 문제가 생길 자리가 없습니다.

## 5. `ScrollBox` — 스크롤 경계에서 잘리지 않게 (#9)

RN `ScrollView`도 가장자리에서 자식을 잘라냅니다. 웹 `.scroll-box`처럼 두 종류의 성장을 각각 처리합니다.

- **크기와 무관하게 일정한 성장**(포커스 링, 글로우, 그림자): bleed로 해결합니다. 안쪽을
  `overlay.scrollBleed`(12)만큼 패딩하고, 바깥을 같은 크기의 음수 마진으로 당겨 위치는
  그대로 둡니다.
- **크기에 비례하는 성장**(scale-up 팝): 고정된 여유 공간으로는 막을 수 없으므로, 스크롤 박스
  안에서는 끕니다. `useInsideScrollBox()`를 확인하는 곳은 다음과 같습니다.
  - kids 입력 포커스 팝
  - 체크 팝
  - Palette 스와치 팝

  작아지는 방향인 kids 눌림 스퀴시는 넘칠 수 없으므로 유지합니다.

## 6. Palette

임시 시트(`TemporarySheet`)를 **선언형 `BottomSheet`로 교체**했습니다. 시트 내용이 Palette의
상태(초안, 오류, 말풍선)를 따라 계속 바뀌므로 선언형 case 2에 해당합니다. 레이아웃은 다음과 같습니다.

- `scrollable={false}`: 스크롤 영역을 Palette가 직접 갖습니다. 그래야 말풍선을 스크롤 영역 **밖**,
  그 위에 띄울 수 있습니다(웹 §2.4와 같은 이유).
- hex 입력과 대비 경고는 시트 `footer`에 고정합니다.
- 이제 Palette는 다른 오버레이 위에서도 문제없이 쌓입니다(예: 모달 안의 색상 입력).

시트 표면은 이제 오버레이 공통 스타일(토큰 기반)을 따릅니다. 웹 Palette 팝오버에만 있던
office 볼록 베벨·여백 2px는 팝오버 고유의 모양이라 시트로는 옮기지 않았습니다.

## 7. testID

웹과 같은 규칙으로 파생합니다.

- `{testID}`: 오버레이. 열려 있거나 퇴장 애니메이션 중일 때만 존재
- `{testID}.panel`
- `{testID}.title`
- `{testID}.close`

열림·닫힘은 `{testID}`가 있는지 없는지로 기다리면 됩니다. 디자인 시스템 화면의 오버레이 데모
testID는 웹 레지스트리와 같은 문자열입니다(`design-system.overlay.*`).

## 8. 검증과 한계

- 자동(`bun run check`):
  - `overlay-stack.test.ts`: 웹과 같은 중첩 규칙(scrim 소유자, 레이어 유지, 재오픈)
  - `tokens.test.ts`: 웹 `:root`의 오버레이 토큰과 스킨별 scrim
- 번들: `expo export`로 Android·iOS 번들 생성까지 확인했습니다.
- **실기기와 시뮬레이터 확인이 필요합니다.**
  - [ ] 모달 위 확인창: scrim이 한 번만 어두워지는지, 뒤로가기가 맨 위만 닫는지
  - [ ] 시트·사이드바 진입과 퇴장: office는 즉시, kids는 overshoot
  - [ ] Palette 시트: 키보드가 올라왔을 때 hex 입력이 가려지지 않는지
  - [ ] VoiceOver/TalkBack: 열 때 제목부터 읽는지, 아래 오버레이가 숨겨지는지
  - [ ] Maestro: `apps/mobile/e2e/design-system-overlays.yaml`
