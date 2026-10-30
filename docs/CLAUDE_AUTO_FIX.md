# Claude 자동 수정 연결

## 준비 상태
2026-10-30 15:35 PR #2의 Codex 검토 결과가 실제 Slack 채널에 도착한 것을 확인했습니다. 기존 Slack workflow는 유지합니다.
이번 자동 수정 workflow는 인증·기능 활성화·사용자 승인 병합 전까지 실행되지 않습니다.

## 동작
저장소 소유자가 만든 동일 저장소의 `claude/` 브랜치, main 대상, 열린 일반 PR만 처리합니다.
Codex 요약 댓글의 완료 상태와 현재 PR SHA가 일치하고 지적 사항이 있으면 Claude를 실행합니다.
Claude는 필요한 기존 파일을 수정하고 테스트 및 HANDOVER 기록을 남깁니다. 후속 단계가 변경 경로·시작 SHA·PR 상태를 확인해 같은 PR에 일반 push한 후 `@codex review`를 요청합니다.
Codex가 다시 완료 결과를 남기면 Slack workflow가 보고하고, 문제가 남았다면 두 번째 수정이 실행됩니다.
최대 2회이며 실패·변경 없음도 1회를 소비합니다. Git 태그에 PR별 횟수를 기록하고 같은 SHA 재실행은 건너뜁니다.
병합은 사용자가 합니다. 자동 병합·배포 명령은 없습니다.

## 소유자 연결 순서
1. 공식 Claude GitHub 앱을 이 저장소에 설치합니다. Claude Code의 `/install-github-app` 또는 공식 설치 안내를 이용합니다.
2. Claude Code에서 `claude setup-token`으로 발급한 인증값을 저장소 Actions Secret `CLAUDE_CODE_OAUTH_TOKEN`으로 저장합니다. 채팅·코드에 붙이지 않습니다. OAuth 사용 한도 및 요금은 본인 Claude 계정을 확인합니다.
3. 이 PR 검토 후 사용자 승인으로 main에 병합합니다.
4. Actions Variables에 `CLAUDE_AUTO_FIX_ENABLED` = `true`를 등록합니다. 중단하려면 `false`로 바꿉니다.
5. `claude/` 브랜치의 시험 PR에서 실제 지적 → 수정 push → Codex 재검토 → Slack 도착 및 최대 2회 제한을 검증합니다. 테스트 전에는 전체 자동화가 검증됐다고 보고하지 않습니다.

## 범위와 제한
- 새 파일·삭제·이름 변경, `.github/`, 에이전트 지침, `backend/wrangler*`, `public/config.js` 변경은 push 전 차단합니다. 해당 수정은 사용자가 별도 검토합니다.
- Claude 자체 테스트는 AI가 수행합니다. 실행 실패는 Actions에 남으며 기존 Slack 알림은 Codex 검토 완료 알림입니다. 실패 알림을 별도로 보장하지 않습니다.
- GitHub Actions 기본 토큰이 작성한 재검토 요청을 Codex 앱이 받아들이는지는 실전 시험이 필요합니다. 자동 재검토가 시작되지 않으면 이 연결을 운영 완료로 간주하지 않습니다.
- Codex HTML 상태 형식 및 외부 Action 동작 변경에 영향을 받습니다. 구문 및 모의 테스트 통과는 실제 Claude 실행 성공을 의미하지 않습니다.
- 횟수 태그를 삭제하면 한도가 초기화되므로 지우지 않습니다.

공식 안내: https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md
인증 입력: https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md

검증: `node --test scripts/auto-fix-guard.test.cjs` — 작성자 위조, 외부 저장소, 오래된 SHA, 중복, 2회 한도, 동시 예약 충돌 포함 10개 테스트.
