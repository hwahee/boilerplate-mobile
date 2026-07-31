# 음성 어시스턴트 연동 (Siri / Bixby / Google Assistant)

**목표: 운전 중 휴대전화를 조작하지 않고 앱의 핵심 기능 몇 개를 쓸 수 있어야 한다.**

이 문서는 그 목표에서 나온 결정과 그 근거를 기록합니다. 코드가 왜 지금 모양인지
알고 싶으면 여기부터 읽으세요.

---

## 1. 근본 제약: 세 어시스턴트는 통합할 수 없다

|                    | Siri (iOS)                | Google Assistant (Android)  | Bixby (Galaxy)                             |
| ------------------ | ------------------------- | --------------------------- | ------------------------------------------ |
| 코드 위치          | 앱 안 (Swift `AppIntent`) | 앱 안 (`res/xml/shortcuts`) | **별도 프로젝트** (Capsule, 삼성 클라우드) |
| 빌드·배포          | 앱 빌드에 포함            | 앱 빌드에 포함              | Bixby Developer Studio → 삼성 서버         |
| 심사               | 없음                      | 없음                        | Marketplace 공개 시 필요                   |
| 서버 직접 호출     | 가능                      | **불가**                    | 가능 (Capsule endpoint)                    |
| 음성으로 결과 응답 | 가능 (`ProvidesDialog`)   | **불가** (앱 열기까지만)    | 가능                                       |
| 호출 방식          | "시리야, {앱이름}에 …"    | "…" (App Actions)           | "빅스비, {캡슐이름}에서 …" (비공개 캡슐)   |

진입점 자체는 플랫폼 API가 서로 무관하므로 **분리가 불가피합니다.** 통합할 수 있는
것은 그 위쪽 전부입니다 — 어떤 동작이 있고, 파라미터가 무엇이고, 사용자가 뭐라고
말하고, 그래서 앱이 무엇을 하는가.

그 통합 지점이 [`src/shared/voice/catalog.ts`](../src/shared/voice/catalog.ts)이고,
세 플랫폼의 네이티브 산출물은 거기서 **생성**됩니다 (`bun run voice:generate`).

---

## 2. 실행 모드 두 가지, 그리고 기본값이 뒤집힌 이유

카탈로그의 모든 인텐트는 `deeplink` 또는 `api` 중 하나입니다.

### `deeplink` (기본값)

```
어시스턴트 → 네이티브 스텁 → mobileboilerplate://voice/<id>?<슬롯>
           → apps/mobile/src/voice/handlers.ts → 기능 실행
```

**이것이 기본값인 이유:** 음성으로 시킬 만한 조작 대부분 — 재생/일시정지, 다음 곡,
검색 실행 — 은 **클라이언트 로컬 상태**입니다. 서버 API로 표현할 수가 없습니다.
플레이어의 재생 상태는 앱 안에 있지 서버에 있지 않습니다.

운전 중 실사용에서 이 경로가 느리지 않은 이유도 중요합니다: 차 안에서는 대개
**앱이 이미 떠 있습니다** (음악을 틀어놓고 운전). 그러면 딥링크는 콜드 스타트가
아니라 warm 전달이고 `Linking` 이벤트가 즉시 받습니다. 콜드 스타트는 느린 예외
경로일 뿐입니다.

### `api`

```
어시스턴트 → 네이티브 스텁 → POST /api/voice/<id> → 음성으로 결과 응답
           (앱은 열리지 않음)
```

**이것이 필요한 이유:** Bixby는 이 방법으로만 대답할 수 있습니다. Capsule은 삼성
클라우드에서 돌기 때문에 딥링크로 앱을 열면 **결과가 Capsule로 돌아오지 않습니다.**
"할 일이 세 개 남았어요" 같은 답을 들으려면 Capsule이 직접 서버를 호출해야 합니다.
iOS에서도 이 모드는 앱을 안 열기 때문에 잠금화면·워치·CarPlay에서 동작합니다.

### 두 모드의 플랫폼별 가용성

|           | `deeplink`          | `api`          |
| --------- | ------------------- | -------------- |
| Siri      | ✅                  | ✅             |
| Bixby     | ✅ (결과 응답 없음) | ✅             |
| Assistant | ✅                  | ❌ — 아래 참고 |

Google Assistant의 커스텀 App Actions capability는 **앱을 여는 것 하나만** 할 수
있습니다. 우리 서버를 호출할 수도, 음성으로 답할 수도 없습니다. 그래서
`voice_shortcuts.generated.xml`에는 `deeplink` 인텐트만 들어갑니다. Galaxy에서
음성으로 **답을 듣는** 시나리오는 Bixby의 몫입니다.

---

## 3. 미디어 재생/일시정지는 인텐트로 만들지 마세요

실제 미디어 플레이어의 transport 제어(재생/일시정지/이전/다음)는 이 구조 밖입니다.

- iOS: `MPRemoteCommandCenter` + `MPNowPlayingInfoCenter`
- Android: `MediaSession`

이걸 붙이면 **App Intent나 Capsule 없이도** "다음 곡"이 동작하고, 잠금화면 컨트롤,
CarPlay, Android Auto, 이어폰 버튼, 스마트워치가 전부 공짜로 따라옵니다. 시스템이
앱을 "미디어 앱"으로 인식하기 때문입니다. `react-native-track-player` 같은
라이브러리가 이미 양쪽을 다 구현해 두었습니다.

같은 일을 커스텀 인텐트로 하면 저 모든 표면을 잃고 발화 문구도 직접 관리해야
합니다. 카탈로그는 미디어 transport가 **아닌** 동작들을 위한 것입니다.

---

## 4. 파일 지도

| 경로                                         | 역할                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/shared/voice/catalog.ts`                | **단일 진실.** 인텐트·슬롯·발화·실행 모드·스코프       |
| `src/shared/voice/link.ts`                   | 딥링크 URL 형식 (빌드/파싱, 플랫폼 무관)               |
| `scripts/generate-voice-artifacts.ts`        | 카탈로그 → Swift / XML / Bixby 학습 파일               |
| `src/server/routes/voice.ts`                 | `POST /api/voice/:intentId`                            |
| `src/server/services/voice-service.ts`       | `api` 인텐트 실행 + 낭독 문장 생성                     |
| `src/server/services/voice-token-service.ts` | 음성 전용 인증 seam                                    |
| `apps/mobile/src/voice/handlers.ts`          | **`deeplink` 인텐트가 실제로 실행되는 곳**             |
| `apps/mobile/src/voice/useVoiceLinks.ts`     | cold/warm 양쪽 URL 수신                                |
| `apps/mobile/native/ios/VoiceSupport.swift`  | 손으로 쓴 Swift (네트워크·키체인·URL)                  |
| `apps/mobile/native/ios/*.generated.swift`   | 생성됨 — 직접 고치지 마세요                            |
| `apps/mobile/native/android/*.generated.xml` | 생성됨 — 직접 고치지 마세요                            |
| `apps/mobile/plugins/withVoiceAssistants.ts` | prebuild 시 네이티브 프로젝트에 주입하는 config plugin |
| `capsule/`                                   | Bixby Capsule (RN 빌드와 무관한 별도 프로젝트)         |

### 인텐트 추가 절차

1. `src/shared/voice/catalog.ts`에 항목 추가
2. `bun run voice:generate`
3. `deeplink`면 `apps/mobile/src/voice/handlers.ts`에, `api`면
   `src/server/services/voice-service.ts`에 핸들러 추가
   — **둘 다 총체(total) 맵이라 핸들러가 없으면 컴파일이 실패합니다**
4. `api`면 `capsule/boilerplate/`에 action model + endpoint JS 추가
5. `bun run check`

`voice:check`가 `check`에 포함되어 있어서, 카탈로그만 고치고 재생성을 잊으면 CI가
잡습니다.

---

## 5. 인증 — 가장 큰 미완성 조각

`api` 인텐트는 **앱 세션 밖**에서 실행됩니다. iOS에서는 별도 프로세스의 Swift가,
Bixby에서는 삼성 클라우드의 Capsule이 호출합니다. 둘 다 앱의 로그인 상태를 빌려올
수 없습니다.

**설계 원칙: 세션 토큰을 공유하지 말고, 로그인 시 음성 전용 스코프 토큰을 따로
발급하세요.** 잠금화면에서 닿을 수 있는 자격증명은 카탈로그에 있는 몇 가지만 할 수
있어야 하고, 독립적으로 폐기 가능해야 합니다.

|           | 토큰을 어떻게 얻는가                      | 현재 상태                     |
| --------- | ----------------------------------------- | ----------------------------- |
| Siri      | 앱과 공유하는 Keychain access group       | **읽기 구현됨, 쓰기 미구현**  |
| Bixby     | OAuth2 account linking                    | 미구현 (공유 시크릿으로 대체) |
| Assistant | 불필요 (`deeplink`만 지원 → 앱 세션 사용) | —                             |

### 남은 네이티브 작업 (iOS)

`VoiceSupport.swift`는 공유 Keychain access group에서 토큰을 **읽습니다.**
`expo-secure-store`가 access group을 노출하지 않아 **쓰는 쪽이 없습니다.** 둘 중
하나가 필요합니다:

- access group을 지원하는 버전의 `expo-secure-store`, 또는
- 토큰을 공유 그룹에 쓰는 작은 네이티브 모듈

그때까지 `api` 인텐트는 "앱을 열어 로그인해 주세요"라고 답합니다.

> **주의 (config plugin에 이미 반영됨):** `keychain-access-groups` 엔타이틀먼트를
> 추가하면 iOS는 **목록의 첫 번째 그룹을 기본값으로** 씁니다. 공유 그룹을 앞에
> 두면 `expo-secure-store`가 이미 저장한 항목들이 조용히 다른 그룹으로 옮겨져
> 업데이트 후 데이터가 사라집니다. 그래서 플러그인은 앱 자신의 그룹을 항상 첫
> 번째에 놓습니다.

또 필요한 것: Apple 개발자 포털의 App ID에 해당 access group 등록.

### 서버 쪽

`VOICE_TOKEN`이 비어 있으면 `/api/voice/*`는 **전부 401**입니다 (`ADMIN_TOKEN`과
같은 방침: 기본 토큰 없음, 익명 모드 없음). 실서비스 전에
`createStaticVoiceTokenVerifier`를 사용자별 검증기로 교체하세요 — 인터페이스만
맞추면 나머지는 그대로입니다.

---

## 6. 발화 문구 설계에서 실제로 걸리는 것들

- **Siri 발화에는 앱 이름이 반드시 들어갑니다.** `AppShortcut`의 phrase에
  `\(.applicationName)`이 없으면 등록되지 않습니다. 카탈로그의 `{appName}` 토큰이
  이걸 강제하고, 테스트가 검증합니다. 결과적으로 "시리야, 할 일 추가"는 불가능하고
  "시리야, Boiler에 할 일 추가"가 됩니다.
- **그래서 앱 이름이 운전 UX의 핵심 변수입니다.** 소음 속 음성 인식이 한 번에
  맞히는 이름이어야 합니다 — 짧고, 동음이의어 없고, 약어 아님.
  `VOICE_INVOCATION_NAME` 주석 참고.
- **비공개 Bixby capsule은 캡슐 이름을 불러야 합니다.** "빅스비, Boiler에서 …".
  Marketplace 심사를 통과해 도메인에 등록되기 전까지는 자연 발화가 안 됩니다.
- **필수 텍스트 슬롯은 인텐트당 하나까지.** 카탈로그 검증이 강제합니다. 운전자가
  여러 슬롯을 채우는 대화를 따라갈 수 없습니다.
- **낭독 문장은 한 번 듣고 이해돼야 합니다.** 서버가 `Accept-Language`에 맞춰
  `@shared/i18n`에서 생성하므로 영어 Siri와 한국어 Bixby가 같은 카탈로그를 씁니다.

---

## 7. 검증 상태 — 무엇이 실제로 확인되었는가

정직하게 구분합니다.

**자동 테스트로 검증됨**

- 카탈로그 정합성, 딥링크 빌드/파싱 (`src/shared/voice/voice.test.ts`)
- `POST /api/voice/*` 전 경로: 실행·현지화·인증·검증·404·426 면제
  (`src/server/http/api.integration.test.ts`)
- RN 딥링크 디스패치, cold start 큐잉 (`apps/mobile/src/voice/handlers.test.ts`)
- 생성 산출물이 카탈로그와 일치 (`bun run voice:check`)

**검증되지 않음 — 실제 빌드가 필요합니다**

이 환경에는 Xcode도 Android SDK도 없어 `expo prebuild`를 돌릴 수 없었습니다.
아래는 코드로만 존재하며 **첫 prebuild가 인수 테스트**입니다:

- config plugin이 Xcode 프로젝트에 Swift를 제대로 등록하는지
- 생성된 Swift가 컴파일되는지 (App Intents API 사용 형태)
- `AppShortcuts.ko.strings`가 Xcode 로컬라이제이션으로 잡히는지
- `voice_shortcuts.xml`을 Google Assistant가 받아들이는지
- Bixby capsule이 Bixby Developer Studio에서 컴파일되는지

### 첫 prebuild 체크리스트

```bash
bun run voice:generate
cd apps/mobile && bunx expo prebuild --clean
```

- [ ] `ios/<Project>/VoiceSupport.swift`, `VoiceIntents.generated.swift` 존재 + Xcode 타깃에 포함
- [ ] `ios/<Project>/ko.lproj/AppShortcuts.strings` 존재
- [ ] `Info.plist`에 `VoiceApiBaseUrl` / `VoiceAppScheme` / `VoiceKeychainAccessGroup`
- [ ] 엔타이틀먼트의 `keychain-access-groups` **첫 항목이 앱 자신의 그룹**
- [ ] `android/app/src/main/res/xml/voice_shortcuts.xml`에 `__VOICE_LINK_ORIGIN__`이 남아있지 않음
- [ ] `AndroidManifest.xml` 런처 액티비티에 `android.app.shortcuts` meta-data
- [ ] 기기에서: 단축어 앱에 인텐트가 보임 → "시리야, Boiler에서 검색" → 앱이 열리고 검색어가 적용됨

---

## 8. 아직 다루지 않은 것

- **Android Auto / CarPlay.** 운전 목표에 가장 직접적인 답이지만 완전히 별개의 큰
  통합입니다. 미디어 앱이라면 3장의 `MediaSession`/`MPRemoteCommandCenter`가 그
  절반을 이미 해결합니다.
- **App Intents Extension.** 현재 App Intent는 메인 앱 타깃에 있습니다. iOS는
  이 경우 인텐트 실행을 위해 **앱 프로세스를 백그라운드로 띄우므로** RN 부팅
  비용이 발생합니다. Extension으로 빼면 사라지지만 타깃 분리가 필요합니다
  (`@bacons/apple-targets` 등). `api` 인텐트 응답이 느리면 이걸 검토하세요.
- **Bixby Marketplace 공개 심사와 자연 발화 등록.**
- **Widget / 잠금화면 위젯**에서 같은 `api` 인텐트 재사용.
