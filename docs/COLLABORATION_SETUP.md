# Codex 검토 결과 Slack 보고

## 동작
Codex 봇의 PR 요약 댓글 생성·수정 이벤트에서 code_review 상태가 completed일 때 Slack Incoming Webhook으로 보고합니다. 현재 PR 최신 커밋과 일치하는 결과만 전송하며, 같은 완료 상태의 단순 댓글 수정은 건너뜁니다. 댓글 본문·PR 코드는 실행하지 않습니다. GitHub 토큰은 읽기 전용입니다.

## 소유자가 완료할 설정
1. Slack 앱의 Incoming Webhooks를 활성화하고 Y Group의 #y-group-전체를 대상으로 Webhook URL을 생성합니다.
2. 저장소 Settings → Secrets and variables → Actions → New repository secret에서 이름을 SLACK_REVIEW_WEBHOOK_URL로 등록합니다. 값은 해당 URL입니다. 채팅·코드·공개 변수에 붙여넣지 마세요.
3. 이 PR 검토 후 사용자 승인으로 main에 병합합니다. issue_comment 자동 실행에는 기본 브랜치에 workflow가 있어야 합니다.
4. Actions → Report Codex review to Slack → Run workflow → main → pr_number에 2를 입력해 기존 완료 리뷰로 전송 시험합니다.
5. Slack 메시지와 Actions 성공을 확인한 뒤, 새 PR 자동 검토 완료 시 자동 보고도 확인합니다. 초기 PR #2 완료 결과는 직접 확인했지만 이 workflow의 실전 전송은 아직 검증 전입니다.

## 제한과 실패 처리
- Codex의 HTML 상태 마커는 관찰된 형식에 의존합니다. 형식 변경 또는 마커 없음은 보고를 생략합니다.
- 지적 사항 유무만 요약하고 상세 검토 링크를 제공합니다. CI 통과나 사용자 병합 승인을 의미하지 않습니다.
- 수동 실행·실패한 실행 재시도는 중복 메시지를 만들 수 있습니다. 시간 초과 후에는 Slack을 먼저 확인하세요. 자동 재시도는 하지 않습니다.
- 이 workflow는 Slack 알림만 수행합니다. Claude 자동 수정 전달, 수정 왕복 최대 2회 강제 제한, 자동 병합은 포함하지 않습니다. 최종 병합은 사용자 승인입니다.
