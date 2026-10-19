import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiUrl, checkAIResult } from '../public/ai-client.js';
test('HTTPS 백엔드 주소만 허용하고 credentials와 경로 삽입 차단', () => {
  assert.equal(normalizeApiUrl('https://example.workers.dev/'), 'https://example.workers.dev');
  assert.equal(normalizeApiUrl('http://localhost:8787'), 'http://localhost:8787');
  for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com/?key=secret', 'javascript:alert(1)']) assert.throws(() => normalizeApiUrl(url));
});
test('잘못된 AI 결과는 편집기에 적용하지 않음', () => {
  for (const value of [null, {}, { name: '상품' }]) assert.throws(() => checkAIResult(value));
});
