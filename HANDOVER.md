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

### 2026-10-30 AGENTS.md 코드 리뷰 지침 추가
- 작업 목표: AGENTS.md에 코드 리뷰 지침(실제 오류·보안 문제 우선, 근거·파일 위치 명시, 한국어 보고) 추가
- 담당 AI: Claude Code
- 진행 상태: 완료
- 수정 파일: `AGENTS.md`, `HANDOVER.md`
- 검증 결과: `git diff`로 `AGENTS.md`·`HANDOVER.md`만 변경됨을 확인. 기능 코드(`public/`, `backend/`, `server.js`)와 배포 설정(`.github/`, `wrangler.toml`)은 변경·삭제 없음.
- 다음 할 일: PR 리뷰 후 main 병합 여부는 사용자가 결정

### 2026-10-29 코덱스 협업 기본 문서 정리
- 작업 목표: 코덱스와 협업하기 위한 기본 문서(공통 원칙·에이전트 안내·인수인계) 정리
- 담당 AI: Claude Code
- 진행 상태: 완료
- 수정 파일: `COMMON_RULES.md`(신규), `AGENTS.md`(신규), `CLAUDE.md`(신규), `HANDOVER.md`(신규)
- 검증 결과: `git status`로 신규 4개 파일만 추가됨을 확인. 기존 파일(`README.md`, `docs/`, `public/`, `backend/`, `server.js`, 배포 설정)은 변경·삭제 없음. `AGENTS.md`·`CLAUDE.md`가 `COMMON_RULES.md`를 링크로 참조하도록 연결됨.
- 다음 할 일: 실제 기능/문서 작업 시 이 템플릿으로 기록 이어가기
