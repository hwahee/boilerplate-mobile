# 팔레트(Palette) — 앱 이식 결정

upstream PR #5(웹 색상 입력, 설계: [palette-design.md](./palette-design.md))를 앱(`apps/mobile`)에
옮기며 내린 결정을 기록합니다. 웹 설계 문서의 결정(값 모델, 프리셋 계약, controlled 단일
모드, `onChange`/`onPreview` 분리, 최근 사용 색은 호출자 책임)은 **그대로 따르고**, 여기에는
휴대폰이라서 달라진 부분만 적습니다.

> 요약: 값·계약·프리셋은 웹과 **공유**, 표현은 **바텀시트 + 누르고 있는 동안 뜨는 말풍선**,
> 3단계 "더 많은 색"은 **iOS에서만 시스템 피커**.

---

## 1. 공유하는 것 — `src/shared/color`

| 모듈                    | 내용                                                       | 사용처       |
| ----------------------- | ---------------------------------------------------------- | ------------ |
| `@shared/color`         | `HexColor`, `parseHexColor`, `contrastRatio` (upstream)    | 웹·앱·(서버) |
| `@shared/color/presets` | `PaletteSwatch`/`PaletteGroup` 타입 + 기본 32색 **(이동)** | 웹·앱        |

기본 스와치는 원래 웹 컴포넌트(`src/client/ui/palette.tsx`) 안에 있었습니다. 앱이 같은
세트를 쓰도록 `src/shared/color/presets.ts`로 옮겼습니다. 웹과 앱이 한 벌을 공유하므로
"Indigo"는 어느 클라이언트에서 골라도 같은 `#6366f1`입니다. 사용자가 고른 색은 사용자의
데이터이므로, 어느 앱에서 골랐는지에 따라 값이 달라지면 안 됩니다.

- `presets.ts`는 facade(`index.ts`)와 **다른 파일**입니다. `index.ts`에서 `export *`로
  다시 내보내면 순환 import가 생기고, 모듈 로드 시점에 `hexColor()`가 초기화되기 전의
  상수를 참조하게 됩니다.
- **upstream과 다른 점**: 웹 `palette.tsx`는 이제 이 모듈을 import합니다. 이후 upstream이
  `palette.tsx`를 수정하면 머지 충돌이 날 수 있습니다. 이 변경은 boilerplate 쪽에도 올리는
  것을 권장합니다.

## 2. 웹 → 앱 대응

| 웹                                  | 앱                                                         | 이유                                                                |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| 트리거 옆 Popover API 팝업          | 화면 아래에서 올라오는 시트                                | 휴대폰에는 트리거 옆 공간이 없고, hex 입력 시 키보드가 올라옴       |
| light dismiss / Esc                 | 배경 탭 / 닫기 버튼 / Android 뒤로가기                     | 값을 바꾸지 않고 닫는다는 의미는 같음                               |
| **호버 툴팁**(이름 + 반환될 문자열) | **누르고 있는 동안 손가락 위에 말풍선**                    | 터치에는 호버가 없음. 키보드 키 미리보기와 같은 방식                |
| 프리셋 클릭 → 확정 + 닫힘           | 손을 떼면 확정 + 닫힘, 밖으로 밀면 취소                    | 웹 §2.2의 "프리셋은 한 번의 동작으로 끝난다"를 유지                 |
| 화살표 키 격자 이동, 로빙 tabindex  | 없음                                                       | 휴대폰에는 키보드 포커스 모델이 없음. 스크린 리더는 스와이프로 이동 |
| hex 입력(blur/Enter 확정)           | 같음(blur/완료 키 확정), 자동 대문자·자동 수정 끔          |                                                                     |
| `<input type="color" alpha>`        | **iOS: `UIColorPickerViewController`** / Android: 없음(§3) |                                                                     |
| 체커보드 위에 칩                    | 반투명 색일 때만 체커보드(View)를 그림                     | 불투명 색은 체커보드를 완전히 덮으므로 결과가 같고 렌더링이 가벼움  |
| 대비 경고(`contrastAgainst`, 버림)  | 같음                                                       |                                                                     |

**말풍선.** 웹과 같이 **시트당 하나**이며, 스크롤 영역 **밖**에 두어 격자 가장자리에서
잘리지 않습니다. 위치 계산은 순수 함수(`components/palette/callout.ts`, 테스트 있음)입니다.
손가락이 스와치를 가리므로 기본 위치는 위쪽이고, 공간이 없으면 아래로 뒤집으며 좌우는
시트 안으로 제한합니다. 장식용이라 접근성 트리에서 빠집니다. 스와치 자체의 접근성 이름이
이미 "이름 (값)"입니다.

## 3. 3단계 "더 많은 색" — iOS만 네이티브

- **iOS**: `UIColorPickerViewController`를 띄웁니다(격자·스펙트럼·슬라이더·불투명도·스포이드).
  - 로컬 Expo 모듈 `apps/mobile/modules/native-color-picker`(Swift)이며, `./modules`는 Expo가 기본으로 자동 연결합니다.
  - 드래그 중에는 `onPreview` 이벤트를 보내고, 피커를 닫을 때 한 번 확정합니다(웹의 `input`/`change`와 같음).
  - 넓은 색역(P3)에서 고른 색은 sRGB hex로 잘라서 저장합니다.
- **Android**: 시스템 색 피커가 없어서 버튼을 **숨깁니다**. 프리셋과 hex 입력만으로도 모든 색을 표현할 수 있습니다.
- **분리 방식**: `components/palette/native-picker.{ios,android}.ts` + `.d.ts`
  ([platform-decisions.md](./platform-decisions.md) #6). Palette는 `nativeColorPickerAvailable`만 확인하고 플랫폼은 모릅니다.
- **Expo Go 등 네이티브 빌드가 없는 실행 환경**: 모듈이 없으면 `requireOptionalNativeModule`이
  `null`을 돌려주므로 버튼이 숨겨지고 앱은 멈추지 않습니다.

기각한 안:

- **양 플랫폼에 JS 슬라이더(HSL + 불투명도)를 직접 구현**: 두 플랫폼이 같아지지만, 웹이
  "직접 만든 피커"를 기각한 이유와 같은 부담(제스처, 스킨별 디자인)을 새로 지게 됩니다.
- **Android용 서드파티 피커**: 의존성이 늘어납니다. 필요해지면 `native-picker.android.ts`가
  들어갈 자리입니다.

## 4. 임시 시트 → BottomSheet 교체 예정

바텀시트 자체는 upstream PR #8(Modal/BottomSheet/Sidebar와 오버레이 스택)에서 들어옵니다.
#8을 옮기기 전까지는 `components/palette/TemporarySheet.tsx`(RN `Modal` 기반)를 씁니다.

- 한계: 오버레이 중첩은 관리되지 않고(한 단계만), 드래그로 닫을 수 없습니다.
- 교체 방법: Palette는 `visible` / `onClose` / `title` / `testID` / 스킨 스타일만 넘기므로,
  #8 이식 때 이 파일 하나를 BottomSheet로 바꾸면 됩니다.

## 5. 스킨 (`theme/skin.ts` → `paletteSkin`)

| 요소               | A/B(앱 전용 값)            | office(웹과 동일)                            | kids(베타, 웹 값)             |
| ------------------ | -------------------------- | -------------------------------------------- | ----------------------------- |
| 스와치 크기        | `minTouchTarget` (44 / 56) | `--control-height × 0.75` = 21, 간격 2       | 36(= 48 × 0.75), 원형         |
| 선택 표시          | 2px 틈 + 4px focus 링      | 안쪽 2px primary 테두리(outline-offset −2px) | A와 같음                      |
| 말풍선             | text 배경 / surface 글자   | **옅은 노란색 `#ffffe1` + 1px 검정 테두리**  | 알약 모양, 굵기 700           |
| 트리거 / 피커 버튼 | 입력 필드 모양             | 오목 베벨, radius 1                          | 굵기 800 + 스티커 그림자      |
| 시트               | surface-raised             | 볼록 베벨, 여백 2                            | 큰 radius + 카드 그림자       |
| 눌림               | —                          | —                                            | 스와치 튀어나옴(×1.25, −2.5°) |

office의 21pt 스와치는 휴대폰 최소 터치 크기보다 작습니다. 웹과 같은 모양을 유지하기 위해
크기는 그대로 두었습니다. 간격이 2pt라 hitSlop은 1pt만 줄 수 있습니다(이웃 스와치와 겹치지
않게). 대신 누르고 있으면 말풍선에 어떤 색인지 표시되고, 손가락을 밀어내면 취소되므로 잘못
누른 것을 바로잡을 수 있습니다.

## 6. testID

| testID                            | 대상                              |
| --------------------------------- | --------------------------------- |
| `{testID}`                        | 트리거 (`expanded` 상태)          |
| `{testID}.sheet` / `.sheet.close` | 시트 / 닫기 버튼                  |
| `{testID}.swatch.{hex}`           | 스와치 (`#` 없는 hex, `selected`) |
| `{testID}.hex` (+ `.hex.error`)   | hex 입력                          |
| `{testID}.native`                 | 시스템 피커 버튼 (iOS에만)        |
| `{testID}.contrast`               | 대비 경고 (조건부)                |

## 7. 검증

- 자동(`bun run check`):
  - `presets.test.ts`: 기본 32색이 모두 정규 hex이고 이름·값이 중복되지 않음
  - `callout.test.ts`: 말풍선 위치 계산
  - `skin.test.ts`: `paletteSkin`
- 번들: `expo export`로 Android·iOS 번들을 만들어 확인했습니다. 네이티브 피커 코드는 **iOS 번들에만** 들어가고, Expo 자동 연결이 로컬 모듈을 찾습니다.
- **아직 확인하지 못한 것**:
  - Swift 모듈 컴파일과 실기기 동작(Xcode 필요)
  - 시트와 말풍선의 실제 모습
  - Maestro 플로우 `apps/mobile/e2e/design-system-palette.yaml`
