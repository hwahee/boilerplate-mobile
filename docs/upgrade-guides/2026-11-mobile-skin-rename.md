# 업스트림 업데이트 적용: 앱 스킨 이름 변경 (A/B → standard/contrast) (2026-11)

이 저장소(boilerplate-mobile)에서 출발한 다운스트림에서 일하는 AI 에이전트를 위한 적용 절차입니다.
boilerplate #28의 스킨 이름 변경을 앱(`apps/mobile`)에도 적용한 변경이며, 웹·공통 쪽 절차는
[2026-11 스킨 이름 변경](2026-11-skin-rename.md)을 함께 따릅니다. 여기에는 **앱에서 머지만으로 끝나지 않는 것만** 적습니다.

| 예전                                        | 지금                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DesignVariant`의 `'a'` / `'b'`             | `'standard'` / `'contrast'` (`@shared/domain/appearance`의 `Design`)                             |
| testID `settings.design.a` / `.b`           | `settings.design.standard` / `.contrast`                                                         |
| 앱 메시지 `settings.design.a` / `.b`        | `settings.design.standard` / `.contrast`                                                         |
| A/B: 앱 전용 치수(본문 16/19, 컨트롤 44/56) | standard/contrast: 웹 값 이식(본문 15, 컨트롤 36 + hitSlop, 모서리 10/16, 그림자, 포커스 링 2/4) |

기기에 저장된 예전 값(`a`/`b`)은 `designVariantFrom()`이 새 이름으로 읽습니다. **이 호환 처리는 지우지 않습니다.**

## 0. 작업 원칙

- 다운스트림의 `CLAUDE.md`가 이 저장소와 다르면 다운스트림 것이 우선입니다.
- **2절의 결정 항목은 에이전트가 정하지 않습니다.** 답을 받기 전에는 기본값으로 둡니다.

## 1. 이미 적용됐는지 확인

| 확인                                                                  | 적용됨의 의미      |
| --------------------------------------------------------------------- | ------------------ |
| `grep -n "'contrast'" apps/mobile/src/theme/tokens.ts`                | 앱이 새 이름을 씀  |
| `grep -n "designVariantFrom" apps/mobile/src/theme/ThemeProvider.tsx` | 저장값 호환이 있음 |

## 2. 사람에게 확인할 결정

| 결정                                                                                          | 기본값(답을 받기 전)                                                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 다운스트림이 앱의 B 치수(큰 글자·큰 컨트롤)를 고쳤거나 제품에서 약속했다면, contrast에 남길지 | upstream을 따름: contrast는 standard와 같은 치수. 변경은 버리고 보고 |

## 3. 조치

1. 다운스트림 앱 코드에서 예전 이름 찾기:
   `grep -rnE "getTokens\('(a|b)'|variant === '(a|b)'|settings\.design\.(a|b)\b|DESIGN_(A|B)_COLORS" apps/mobile`.
   `Record<DesignVariant, …>`처럼 타입으로 묶인 곳은 `bun run typecheck:mobile`이 찾아 줍니다.
2. 다운스트림이 더한 앱 로케일에는 `settings.design.standard`, `settings.design.contrast`를 더합니다.
3. UI 자동화(Maestro 등)의 `settings.design.a` / `.b`를 새 testID로 바꿉니다.
4. 검증: `bun run check` 통과. 설정에서 네 스킨이 standard → contrast → office → kids 순서로 보이고,
   contrast가 standard와 같은 크기에 색과 선 두께만 다릅니다. `tokens.test.ts`가 네 스킨 모두를 웹 CSS와 비교합니다.
5. 다운스트림이 앱 standard/contrast 화면을 예전 크기(컨트롤 44, 본문 16)에 맞춰 짰다면, 줄어든 크기에서 레이아웃을 확인합니다.

## 4. 완료 조건

- `bun run check` 통과, 3절 1번의 grep이 아무것도 찾지 않음.
- `designVariantFrom`(예전 이름 호환)이 남아 있음.
- 2절의 결정이 사람에게서 왔거나 기본값으로 남아 있고, 그 사실을 보고함.
