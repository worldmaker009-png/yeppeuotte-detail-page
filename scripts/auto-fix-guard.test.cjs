const {test} = require('node:test');
const assert = require('node:assert/strict');
const guard = require('./auto-fix-guard.cjs');
const sha = 'a'.repeat(40);
async function run({findings=true, login='chatgpt-codex-connector[bot]', refs=[], head=sha, fork=false, conflict=false}={}) {
  const outputs = {}, claims=[];
  const body = '<!-- codex-review-state:v1 '+JSON.stringify({code_review:{status:'completed',commit_sha:sha,has_any_findings:findings}})+' -->';
  await guard({context:{repo:{owner:'owner',repo:'repo'},payload:{issue:{number:4,pull_request:{}},comment:{user:{login},body}}},core:{setOutput:(k,v)=>outputs[k]=v,notice:()=>{}},github:{rest:{pulls:{get:async()=>({data:{number:4,state:'open',draft:false,base:{ref:'main'},head:{ref:'claude/work',sha:head,repo:{full_name:fork?'other/repo':'owner/repo'}},user:{login:'owner'}}})},git:{listMatchingRefs:async()=>({data:refs}),createRef:async x=>{if(conflict) throw {status:422};claims.push(x);}}}}});
  return {outputs,claims};
}
test('valid finding reserves first attempt',async()=>assert.equal((await run()).outputs.round,'1'));
test('no findings does not launch',async()=>assert.equal((await run({findings:false})).outputs.run,'false'));
test('forged author does not launch',async()=>assert.equal((await run({login:'someone'})).outputs.run,'false'));
test('stale commit does not launch',async()=>assert.equal((await run({head:'b'.repeat(40)})).outputs.run,'false'));
test('fork does not launch',async()=>assert.equal((await run({fork:true})).outputs.run,'false'));
test('same commit cannot consume twice',async()=>assert.equal((await run({refs:[{ref:'refs/tags/ai-fix/pr-4/round-1',object:{sha}}]})).outputs.run,'false'));
test('second attempt allowed',async()=>assert.equal((await run({refs:[{ref:'refs/tags/ai-fix/pr-4/round-1',object:{sha:'b'.repeat(40)}}]})).outputs.round,'2'));
test('third attempt blocked',async()=>assert.equal((await run({refs:[1,2].map(n=>({ref:`refs/tags/ai-fix/pr-4/round-${n}`,object:{sha:'b'.repeat(40)}}))})).outputs.run,'false'));
test('race never consumes next slot',async()=>assert.equal((await run({conflict:true})).outputs.run,'false'));
test('invalid state rejected',()=>assert.equal(guard.review('<!-- codex-review-state:v1 {} -->'),null));
