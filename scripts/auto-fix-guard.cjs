const BOT = 'chatgpt-codex-connector[bot]';
function review(body) {
  try {
    const m = (body || '').match(/<!-- codex-review-state:v1 (.*?) -->/s);
    const r = m && JSON.parse(m[1]).code_review;
    return r && r.status === 'completed' && /^[a-f0-9]{40}$/.test(r.commit_sha) &&
      typeof r.has_any_findings === 'boolean' ? r : null;
  } catch { return null; }
}
module.exports = async ({github, context, core}) => {
  core.setOutput('run', 'false');
  const e = context.payload;
  if (!e.issue?.pull_request || e.comment?.user?.login !== BOT) return;
  const r = review(e.comment.body);
  if (!r || !r.has_any_findings) return;
  const p = {...context.repo, pull_number: e.issue.number};
  const {data: pr} = await github.rest.pulls.get(p);
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'main' ||
      pr.head.repo?.full_name !== `${context.repo.owner}/${context.repo.repo}` ||
      pr.user.login !== context.repo.owner || !pr.head.ref.startsWith('claude/') ||
      pr.head.sha !== r.commit_sha) return;
  // Tags are an atomic, persistent attempt ledger; failed attempts also consume a slot.
  const prefix = `tags/ai-fix/pr-${pr.number}/round-`;
  const {data: refs} = await github.rest.git.listMatchingRefs({...context.repo, ref: prefix});
  if (refs.some(x => x.object.sha === r.commit_sha)) return;
  const used = refs.filter(x => /^refs\/tags\/ai-fix\/pr-\d+\/round-[12]$/.test(x.ref));
  if (used.length >= 2) {
    core.notice('자동 수정 2회 한도 도달. 사용자 확인이 필요합니다.');
    return;
  }
  const round = used.length + 1;
  try {
    await github.rest.git.createRef({...context.repo, ref: `refs/${prefix}${round}`, sha: r.commit_sha});
  } catch (error) {
    if (error.status === 422) return; // Another run claimed this slot. Never try the next slot.
    throw error;
  }
  core.setOutput('run', 'true');
  core.setOutput('number', String(pr.number));
  core.setOutput('sha', r.commit_sha);
  core.setOutput('branch', pr.head.ref);
  core.setOutput('round', String(round));
};
module.exports.review = review;
