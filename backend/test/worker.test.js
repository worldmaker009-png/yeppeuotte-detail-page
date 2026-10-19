import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateResult, validateImages, GenerationLimiter } from '../src/worker.js';
const origin = 'https://worldmaker009-png.github.io';
const token = 'test-only-admin-password-32-characters';
// A transport-level JPEG sentinel; provider behavior is explicitly mocked in these tests.
const image = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(255,216,255,0,255,217));
const result = { name: '라운드 버튼 가디건', category: '가디건', introduction: '단정한 라운드 라인이 돋보이는 가디건입니다.', visualMaterial: '사진상 잔잔한 조직감이 보입니다.', colors: ['아이보리'], designPoints: ['라운드 네크라인', '전면 버튼 디테일'], styling: ['데님과 함께 데일리 룩으로 연출해 보세요.'] };
function env() {
  return { ALLOWED_ORIGIN: origin, ADMIN_TOKEN: token, OPENAI_API_KEY: 'unit-test-provider-key', RATE_LIMITER: { idFromName: v => v, get: () => ({ fetch: async () => new Response('{}') }) } };
}
function request(path = '/generate', { originValue = origin, auth = token, body = { images: [image, image, image] }, method = 'POST' } = {}) {
  return new Request('https://api.example.com' + path, { method, headers: { Origin: originValue, Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
}
function provider(data = result) { return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] }), { headers: { 'Content-Type': 'application/json' } }); }

test('미연결 상태는 명시적으로 표시하고 provider를 호출하지 않음', async () => {
  const handle = createHandler(() => { throw Error('must not call provider'); });
  const e = { ALLOWED_ORIGIN: origin };
  const health = await handle(request('/health', { method: 'GET' }), e);
  const healthData = await health.json(); assert.equal(healthData.configured, false); assert.equal(healthData.imageConfigured, false); assert.equal(healthData.providerVerified, false);
  const response = await handle(request(), e); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'NOT_CONFIGURED');
});
test('설정 확인은 실제 provider 검증과 구별됨', async () => {
  const response = await createHandler()(request('/health', { method: 'GET' }), env());
  const data = await response.json(); assert.equal(data.configured, true); assert.equal(data.providerVerified, false); assert.equal(data.imageProviderVerified, false); assert.equal(data.estimate.estimated, true);
});
test('출처, 인증, 사진 수와 MIME 검증으로 비용 발생 전 차단', async () => {
  let calls = 0; const handle = createHandler(async () => { calls++; return provider(); });
  for (const [opts, status] of [[{ originValue: 'https://attacker.invalid' }, 403], [{ auth: 'incorrect' }, 401], [{ body: { images: [image] } }, 400], [{ body: { images: Array(11).fill(image) } }, 400], [{ body: { images: Array(3).fill('data:image/png;base64,AAAA') } }, 400]]) {
    assert.equal((await handle(request('/generate', opts), env())).status, status);
  }
  assert.equal(calls, 0);
});
test('CORS preflight는 지정 출처만 허용하며 인증 헤더 지원', async () => {
  const response = await createHandler()(request('/generate', { method: 'OPTIONS' }), env());
  assert.equal(response.status, 204); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.ok(response.headers.get('Access-Control-Allow-Headers').includes('Authorization'));
});
test('실제 provider 요청 형식 구성과 구조화 결과 전달 (외부 API는 mock)', async () => {
  let payload;
  const handle = createHandler(async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    payload = JSON.parse(options.body); assert.equal(options.headers.Authorization, 'Bearer unit-test-provider-key'); return provider();
  });
  const response = await handle(request(), env()); assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result, result);
  assert.equal(payload.store, false); assert.equal(payload.text.format.strict, true);
  assert.equal(payload.input[0].content.filter(v => v.type === 'input_image').length, 3);
  assert.match(payload.instructions, /세탁 방법/);
  assert.ok(!('sizes' in payload.text.format.schema.properties));
});
test('provider 인증·과금 오류를 안전하게 전달하고 민감 응답을 노출하지 않음', async () => {
  for (const status of [401, 403, 429, 500]) {
    const response = await createHandler(async () => new Response('secret-provider-diagnostics', { status }))(request(), env());
    assert.ok(response.status >= 500); assert.ok(!(await response.text()).includes('secret-provider-diagnostics'));
  }
});
test('중단·거절·비정상·검증되지 않은 주장 결과는 성공으로 반환하지 않음', async () => {
  const outputs = [new Response(JSON.stringify({ status: 'incomplete', output: [] })), new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] })), provider({ ...result, introduction: '면 100% 입니다.' }), provider({ ...result, styling: ['세탁기로 세탁하세요.'] }), provider({ ...result, name: 'x'.repeat(101) })];
  for (const output of outputs) { const r = await createHandler(async () => output)(request(), env()); assert.notEqual(r.status, 200); }
});
test('provider 타임아웃과 요청 제한을 명시적으로 반환', async () => {
  const timeout = await createHandler(async () => { throw Error('timeout'); })(request(), env()); assert.equal(timeout.status, 504);
  const e = env(); e.RATE_LIMITER.get = () => ({ fetch: async () => new Response('{}', { status: 429 }) });
  const response = await createHandler(() => { throw Error('must not call'); })(request(), e); assert.equal(response.status, 429);
});
test('전체 payload 스트리밍 크기 제한', async () => {
  const large = new Request('https://api.example.com/generate', { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: ' '.repeat(16 * 1024 * 1024 + 1) });
  const response = await createHandler()(large, env()); assert.equal(response.status, 413);
});
test('원자적 요청 제한: 3회/분 및 일일 상한과 재시작 시 저장값 재사용', async () => {
  const values = new Map();
  const storage = { get: async k => values.get(k), put: async (k,v) => values.set(k,v), transaction: async fn => fn(storage) };
  const limiter = new GenerationLimiter({ storage });
  const reserve = (instance, limit = '30') => instance.fetch(new Request('https://limiter/reserve', { method: 'POST', body: JSON.stringify({ dailyLimit: limit }) }));
  for (let i = 0; i < 3; i++) assert.equal((await reserve(limiter)).status, 200);
  assert.equal((await reserve(new GenerationLimiter({storage}))).status, 429);
  values.clear(); assert.equal((await reserve(limiter, '1')).status, 200); assert.equal((await reserve(limiter, '1')).status, 429);
});
test('사진 및 결과 타입 검증은 불필요한 필드를 전달하지 않음', () => {
  assert.equal(validateImages({ images: Array(3).fill(image) }).length, 3);
  assert.deepEqual(validateResult({ ...result, unexpected: 'ignore' }), result);
});
