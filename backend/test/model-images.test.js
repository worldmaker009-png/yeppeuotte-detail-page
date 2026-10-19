import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, GenerationLimiter } from '../src/worker.js';
import { estimateCost } from '../src/model-images.js';
const origin = 'https://worldmaker009-png.github.io', token = 'test-only-long-admin-token-for-images';
const jpeg = 'data:image/jpeg;base64,' + btoa(String.fromCharCode(255,216,255,0,255,217));
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=';
const environment = () => ({ ALLOWED_ORIGIN: origin, OPENAI_API_KEY: 'test-provider-key', ADMIN_TOKEN: token, RATE_LIMITER: { idFromName: v => v, get: () => ({ fetch: async () => new Response('{}') }) } });
const request = body => new Request('https://api.example.com/model-image', { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const body = extra => ({ images: Array(3).fill(jpeg), view: 'front', background: 'ivory', ...extra });
test('마네킹 편집 API는 원본과 인물 참조를 multipart로 전달 (외부 생성은 mock)', async () => {
  let form;
  const handler = createHandler(async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits'); assert.equal(options.headers.Authorization, 'Bearer test-provider-key');
    form = options.body; return new Response(JSON.stringify({ data: [{ b64_json: png }], usage: { total_tokens: 100 } }));
  });
  const response = await handler(request(body({ view: 'side', identity: jpeg })), environment());
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.source, 'openai-images'); assert.equal(result.view, 'side'); assert.equal(result.usage.total_tokens, 100);
  assert.equal(form.get('model'), 'gpt-image-1.5'); assert.equal(form.get('input_fidelity'), 'high'); assert.equal(form.get('quality'), 'high'); assert.equal(form.get('size'), '1024x1536');
  assert.equal(form.getAll('image[]').length, 4); assert.match(form.get('prompt'), /동일한 얼굴/); assert.match(form.get('prompt'), /단추 개수/);
  assert.equal(form.get('response_format'), null);
});
test('측면·전신·상반신은 인물 기준 없이 요청할 수 없고 임의 옵션은 차단', async () => {
  const handler = createHandler(() => { throw Error('must not call'); });
  for (const overrides of [{ view: 'side' }, { view: 'full' }, { view: 'upper' }, { view: 'unknown' }, { background: 'javascript' }, { identity: 'http://example.com/image.jpg' }]) assert.equal((await handler(request(body(overrides)), environment())).status, 400);
});
test('이미지 API 미연결·권한·결제·비정상 결과는 생성 성공으로 처리하지 않음', async () => {
  assert.equal((await createHandler()(request(body()), { ALLOWED_ORIGIN: origin })).status, 503);
  for (const output of [new Response('secret-detail', { status: 403 }), new Response('quota', { status: 429 }), new Response('{}'), new Response(JSON.stringify({ data: [{ url: 'https://untrusted.example/photo' }] }))]) {
    const response = await createHandler(async () => output)(request(body()), environment()); assert.ok(response.status >= 500); assert.ok(!(await response.text()).includes('secret-detail'));
  }
});
test('이미지 요청은 별도 영속 사용 한도로 예약하고 실패시 자동 재시도하지 않음', async () => {
  let calls = 0, budget;
  const env = environment(); env.IMAGE_DAILY_LIMIT = '4'; env.RATE_LIMITER.get = () => ({ fetch: async (url, options) => { budget = JSON.parse(options.body); return new Response('{}'); } });
  const response = await createHandler(async () => { calls++; throw Error('network'); })(request(body()), env);
  assert.equal(response.status, 504); assert.equal(calls, 1); assert.equal(budget.kind, 'image'); assert.equal(budget.dailyLimit, '4');
});
test('단가 예시는 실제 청구 금액과 구분하고 상품당 합계를 계산', () => {
  const estimate = estimateCost({ IMAGE_ESTIMATE_USD: '.25', TEXT_ESTIMATE_USD: '.03' }, 4);
  assert.equal(estimate.totalUSD, 1.03); assert.equal(estimate.estimated, true); assert.match(estimate.basis, /not-a-quote/);
  assert.equal(estimateCost({IMAGE_ESTIMATE_USD:'invalid'},2).imageUSD,.25);
});
test('4구도 생성은 이미지 분당 제한 내에서 가능하고 텍스트 예산과 분리됨', async () => {
  const values = new Map();
  const storage = { get: async key => values.get(key), put: async (key, value) => values.set(key, value), transaction: async fn => fn(storage) };
  const limiter = new GenerationLimiter({ storage });
  const reserve = kind => limiter.fetch(new Request('https://limiter/reserve', { method: 'POST', body: JSON.stringify({ kind, dailyLimit: '30' }) }));
  for (let i = 0; i < 6; i++) assert.equal((await reserve('image')).status, 200);
  assert.equal((await reserve('image')).status, 429);
  assert.equal((await reserve('text')).status, 200);
  assert.equal(values.get('image-budget').recent, 6); assert.equal(values.get('budget').recent, 1);
});
