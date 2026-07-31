# Bixby Capsule

이 디렉터리는 **React Native 빌드의 일부가 아닙니다.** Bixby capsule은 삼성
클라우드에서 실행되는 별도 프로젝트로, Bixby Developer Studio에서 열고 삼성 서버로
배포합니다. 앱 스토어와는 무관합니다.

이 저장소의 툴체인(eslint / prettier / tsc / knip)은 `capsule/`을 건드리지 않습니다.

## 앱과 공유하는 것

- 여기의 action들은 [`src/shared/voice/catalog.ts`](../src/shared/voice/catalog.ts)의
  `api` 인텐트와 1:1 대응합니다.
- `resources/<locale>/training/*.training.bxb`는 같은 카탈로그에서
  **생성**됩니다 (`bun run voice:generate`). 직접 고치지 마세요.
- `code/voiceApi.js`는 Siri의 App Intent가 호출하는 것과 **똑같은**
  `POST /api/voice/<id>` 엔드포인트를 호출합니다.

`api` 인텐트만 여기 있습니다. 앱을 딥링크로 열기만 하는 capsule은 무슨 일이
일어났는지 알 수 없어 사용자에게 답할 수 없고, 운전 중에 Bixby를 쓰는 이유가
바로 그 "답"이기 때문입니다.

## 설정

`resources/base/capsule.properties`는 **키만 문서화**합니다.

- `remote.apiBaseUrl` — 공개 값
- `secret.voiceToken` — Bixby Developer Console의 Capsule > Secrets에서 설정.
  절대 커밋하지 마세요.

공유 시크릿은 임시방편입니다. 실서비스에서는 모든 Bixby 사용자가 같은 주체로
행동하게 되므로, **OAuth2 account linking**으로 교체하고 `$vivContext.accessToken`을
쓰세요. 자세한 내용은 [../docs/voice-assistant.md](../docs/voice-assistant.md)의
인증 절.

## 검증 상태

이 스캐폴드는 Bixby Developer Studio에서 **컴파일 검증되지 않았습니다** — 이
환경에 해당 IDE가 없습니다. 구조와 파일 배치는 Bixby 규약에 맞춰 작성했지만,
첫 컴파일에서 조정이 필요할 수 있습니다.
