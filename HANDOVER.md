# HANDOVER — 인수인계 문서

이 문서는 작업자(사람·코덱스·Claude Code)가 **서로 작업을 넘겨받기 위한 기록**입니다. 새 작업을 마칠 때마다 아래 템플릿을 복사해 맨 위에 **최신 기록을 추가**하세요. 기존 기록은 지우지 말고 남겨 두세요.

## 기록 템플릿
```
### [날짜] 작업 제목
- 작업 목표:
- 담당 AI(또는 사람):
- 진행 상태: (예: 완료 / 진행 중 / 보류)
- 수정 파일:
- 검증 결과:
- 다음 할 일:
```

---

## 작업 기록

### 2026-10-30 Claude 자동 수정 2회 제한 구현
- 목표: Codex 지적 → Claude 수정 → 재검토 요청 자동화
- 담당: Codex
- 상태: 코드 및 모의 검증 완료, 인증·사용자 병합·활성화·실전 검증 대기
- 수정 파일: `.github/workflows/claude-auto-fix.yml`, `scripts/auto-fix-guard.cjs`, `scripts/auto-fix-guard.test.cjs`, `docs/CLAUDE_AUTO_FIX.md`, `HANDOVER.md`
- 검증: 상태/작성자/동일 저장소/SHA/중복/2회 한도/예약 충돌 등 10개 테스트 및 YAML 파싱 통과. Slack 기존 수동 실행은 15:35 채널 도착 확인. 실제 Claude 실행과 자동 재검토는 미검증.
- 다음: Claude GitHub 앱·OAuth Secret 연결, 검토 후 사용자 병합, 활성화 변수 설정, 실제 왕복 시험. 자동 병합 없음.

### 2026-10-30 Codex 검토 Slack 보고 준비
- 작업 목표: Codex 검토 완료를 Slack에 자동 보고
- 담당 AI: Codex
- 진행 상태: 구현·로컬 검증 완료, Secret 등록·사용자 병합·실전 검증 대기
- 수정 파일: `.github/workflows/codex-review-slack.yml`, `docs/COLLABORATION_SETUP.md`, `HANDOVER.md`
- 검증 결과: Python 구문 및 상태 파싱·오래된 커밋 생략·동일 상태 수정 생략·Slack 성공 응답 모의 검증 통과. 실제 Webhook 미등록으로 실전 전송 미검증. 기능 코드와 기존 배포 workflow 변경 없음.
- 다음 할 일: Slack Webhook Secret 등록, 사용자 승인 병합, PR #2 수동 보고 및 새 PR 자동 보고 확인. 자동 수정 왕복 2회 제한은 별도 구축.

### 2026-10-29 코덱스 협업 기본 문서 정리
- 작업 목표: 코덱스와 협업하기 위한 기본 문서(공통 원칙·에이전트 안내·인수인계) 정리
- 담당 AI: Claude Code
- 진행 상태: 완료
- 수정 파일: `COMMON_RULES.md`(신규), `AGENTS.md`(신규), `CLAUDE.md`(신규), `HANDOVER.md`(신규)
- 검증 결과: `git status`로 신규 4개 파일만 추가됨을 확인. 기존 파일(`README.md`, `docs/`, `public/`, `backend/`, `server.js`, 배포 설정)은 변경·삭제 없음. `AGENTS.md`·`CLAUDE.md`가 `COMMON_RULES.md`를 링크로 참조하도록 연결됨.
- 다음 할 일: 실제 기능/문서 작업 시 이 템플릿으로 기록 이어가기
