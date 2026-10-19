// Integration tests use explicit mocked AI responses. They do NOT verify live OpenAI access.
import { chromium } from 'playwright-core';
import http from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const base = '/yeppeuotte-detail-page/';
const server = http.createServer(async (req, res) => {
  try {
    if (!req.url.startsWith(base)) throw Error('path');
    const file = req.url.slice(base.length) || 'index.html';
    if (file.includes('..')) throw Error('path');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await readFile(path.join(root, file)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
let browser;
try {
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: 'chrome' }), args: ['--no-sandbox'], headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}${base}`);
  assert.match(await page.locator('#ai-connection').textContent(), /AI API 연결 필요/);
  await page.locator('#ai-generate').click(); assert.match(await page.locator('#ai-status').textContent(), /AI API 연결 필요/);
  await page.getByText('AI API 연결 설정', { exact: true }).click();
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 900;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e1d8ca'; ctx.fillRect(0, 0, 600, 900);
    ctx.fillStyle = '#f6f2e8'; ctx.fillRect(140, 100, 320, 700); return canvas.toDataURL().split(',')[1];
  });
  const photo = i => ({ name: `원본-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') });
  await page.locator('#photos').setInputFiles([photo(1), photo(2)]);
  await page.waitForFunction(() => document.querySelector('#photo-count').textContent === '2 / 10');
  await page.locator('#api-url').fill('https://test-backend.example');
  await page.locator('#ai-generate').click(); assert.match(await page.locator('#ai-status').textContent(), /3~10장/);
  await page.locator('#photos').setInputFiles(photo(3));
  await page.waitForFunction(() => document.querySelector('#photo-count').textContent === '3 / 10');
  for (const [key, value] of Object.entries({ name: '직접 입력 가디건', price: '39000', material: '판매자 확인 면 100%', sizes: '판매자 확인 FREE', care: '판매자 확인 손세탁', introduction: '직접 작성한 소개입니다.' })) await page.locator(`[name=${key}]`).fill(value);
  await page.locator('#generate').click();
  await page.waitForFunction(() => !document.querySelector('#download').disabled);
  assert.equal(await page.locator('#description').inputValue(), '직접 작성한 소개입니다.');
  assert.equal(await page.locator('#canvases canvas').first().getAttribute('width'), '1720');
  await page.locator('#description').fill('빠른 편집으로 바꾼 소개입니다.');
  await page.locator('#apply-copy').click(); await page.waitForFunction(() => !document.querySelector('#download').disabled);
  assert.equal(await page.locator('[name=introduction]').inputValue(), '빠른 편집으로 바꾼 소개입니다.');
  let configured = false, mode = 'failure', calls = 0, imageFailure = false;
  const modelCalls = [];
  await page.route('https://test-backend.example/**', async route => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (new URL(request.url()).pathname === '/health') return route.fulfill({ status: 200, headers, body: JSON.stringify({ configured, providerVerified: false }) });
    assert.equal(request.headers().authorization, 'Bearer test-browser-admin-password');
    const sent = request.postDataJSON(); assert.equal(sent.images.length, 3); assert.ok(sent.images.every(v => v.startsWith('data:image/jpeg;base64,')));
    assert.ok(!JSON.stringify(sent).includes('원본-'));
    if (new URL(request.url()).pathname === '/model-image') {
      modelCalls.push(sent);
      if (imageFailure) return route.fulfill({ status: 503, headers, body: JSON.stringify({ error: { message: '이미지 API 접근 권한 필요' } }) });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ source: 'openai-images', image: 'data:image/png;base64,' + fixture, view: sent.view, usage: { total_tokens: 100 } }) });
    }
    calls++;
    if (mode === 'failure') return route.fulfill({ status: 503, headers, body: JSON.stringify({ error: { message: 'AI API 키 설정 필요' } }) });
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ source: 'openai', result: { name: `AI 테스트 가디건 ${calls}`, category: '가디건', introduction: '사진에서 단정한 버튼 라인이 보이는 가디건입니다.', visualMaterial: '사진상 잔잔한 조직감이 보입니다.', colors: ['아이보리'], designPoints: ['라운드 네크라인', '전면 버튼 디테일'], styling: ['데님과 함께 연출해 보세요.'] } }) });
  });
  await page.locator('#ai-consent').check(); await page.locator('#admin-token').fill('test-browser-admin-password');
  await page.locator('#ai-generate').click(); await page.waitForFunction(() => document.querySelector('#ai-status').textContent.includes('AI 생성 실패'));
  assert.equal(calls, 0); assert.equal(await page.locator('[name=name]').inputValue(), '직접 입력 가디건');
  configured = true;
  await page.locator('#ai-generate').click(); await page.waitForFunction(() => document.querySelector('#ai-status').textContent.includes('AI API 키 설정 필요'));
  assert.equal(await page.locator('[name=name]').inputValue(), '직접 입력 가디건');
  mode = 'success';
  await page.locator('#ai-generate').click(); await page.waitForFunction(() => document.querySelector('#ai-status').textContent.startsWith('AI 생성 완료'));
  for (const [key, value] of Object.entries({ material: '판매자 확인 면 100%', sizes: '판매자 확인 FREE', care: '판매자 확인 손세탁', price: '39000' })) assert.equal(await page.locator(`[name=${key}]`).inputValue(), value);
  assert.match(await page.locator('[name=designPoints]').inputValue(), /라운드/);
  await page.locator('[name=styling]').fill('판매자가 수정한 코디 추천');
  await page.locator('#generate').click(); await page.waitForFunction(() => !document.querySelector('#download').disabled);
  assert.equal(await page.locator('[name=styling]').inputValue(), '판매자가 수정한 코디 추천');
  const before = await page.locator('[name=name]').inputValue();
  await page.locator('#ai-regenerate').click(); await page.waitForFunction(() => document.querySelector('#ai-status').textContent.startsWith('AI 생성 완료'));
  assert.notEqual(await page.locator('[name=name]').inputValue(), before);
  const downloadEvent = page.waitForEvent('download'); await page.locator('#download').click();
  const download = await downloadEvent; const output = await mkdtemp(path.join(tmpdir(), 'yeppeuotte-ai-smoke-'));
  const filename = path.join(output, 'detail.png'); await download.saveAs(filename);
  const png = await readFile(filename); assert.equal(png.readUInt32BE(16), 1720); assert.ok(png.readUInt32BE(20) <= 12000);
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:path.join(output, 'mobile.png'),fullPage:true});
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({path:path.join(output, 'desktop.png'),fullPage:true});
  const tall = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 100; c.height = 1000;
    const x = c.getContext('2d'); x.fillStyle = '#ddd2c1'; x.fillRect(0, 0, 100, 1000); return c.toDataURL().split(',')[1];
  });
  await page.locator('#photos').setInputFiles(Array.from({ length: 7 }, (_, i) => ({ name: `긴사진-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(tall, 'base64') })));
  await page.waitForFunction(() => document.querySelector('#photo-count').textContent === '10 / 10');
  assert.equal(await page.locator('#download').isDisabled(), true);
  await page.locator('#generate').click(); await page.waitForFunction(() => !document.querySelector('#download').disabled);
  const dimensions = await page.locator('#canvases canvas').evaluateAll(canvases => canvases.map(c => [c.width, c.height]));
  assert.ok(dimensions.length > 1); assert.ok(dimensions.every(([w, h]) => w === 1720 && h <= 12000));
  // Unknown composition / dimensions / care stay blank through AI; no fabricated facts.
  for (const key of ['material', 'sizes', 'care', 'price']) await page.locator(`[name=${key}]`).fill('');
  await page.locator('[name=resolution]').selectOption('1');
  // Use three photos again to keep the subsequent mock request deterministic.
  for (let i = 0; i < 7; i++) await page.locator('.photo-actions button', { hasText: '삭제' }).last().click();
  await page.locator('#ai-regenerate').click(); await page.waitForFunction(() => document.querySelector('#ai-status').textContent.startsWith('AI 생성 완료'));
  for (const key of ['material', 'sizes', 'care', 'price']) assert.equal(await page.locator(`[name=${key}]`).inputValue(), '');
  assert.equal(await page.locator('#canvases canvas').first().getAttribute('width'), '860');
  assert.match(await page.locator('#model-cost').textContent(), /\$1.03/);
  await page.locator('#model-generate').click();
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.startsWith('실제 이미지 API 생성 완료'));
  assert.deepEqual(modelCalls.map(v => v.view), ['front', 'side', 'full', 'upper']);
  assert.equal(modelCalls[0].identity, undefined);
  assert.ok(modelCalls.slice(1).every(v => v.identity.startsWith('data:image/jpeg;base64,')));
  assert.equal(await page.locator('.model-card').count(), 4);
  await page.getByRole('button', { name: '정면 전신 원본 비교', exact: true }).click();
  assert.equal(await page.locator('.compare-dialog img').count(),2);
  await page.getByRole('combobox', { name:'비교할 원본 사진' }).selectOption('1');
  await page.getByRole('button',{name:'비교 닫기',exact:true}).click();
  assert.equal(await page.locator('#download').isDisabled(), true);
  for (let i = 0; i < 4; i++) await page.getByRole('checkbox', { name: /검수 완료/ }).nth(i).check();
  await page.locator('#generate').click(); await page.waitForFunction(() => !document.querySelector('#download').disabled);
  const modelDownloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '정면 전신 PNG 저장', exact: true }).click();
  const modelDownload = await modelDownloadEvent; await modelDownload.saveAs(path.join(output,'model-disclosed.png'));
  const modelData = (await readFile(path.join(output,'model-disclosed.png'))).toString('base64');
  const watermarked = await page.evaluate(async value => {
    const image = new Image(); image.src = 'data:image/png;base64,' + value; await image.decode();
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const x = c.getContext('2d'); x.drawImage(image,0,0);
    return x.getImageData(22,image.height-60,1,1).data[0] > 245;
  }, modelData);
  assert.equal(watermarked, true);
  const previousModel = await page.locator('.model-card img').last().getAttribute('src');
  imageFailure = true; await page.getByRole('button', { name: '상반신 재생성', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.includes('이미지 API 접근 권한 필요'));
  assert.equal(await page.locator('.model-card img').last().getAttribute('src'), previousModel);
  assert.equal(await page.locator('.model-card').count(), 4);
  imageFailure = false; await page.locator('#model-background').selectOption('gray');
  await page.getByRole('button', { name: '정면 전신 재생성', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#model-status').textContent.startsWith('실제 이미지 API 생성 완료'));
  assert.ok(modelCalls.at(-1).identity); assert.equal(modelCalls.at(-1).background,'gray');
  assert.equal(await page.locator('#download').isDisabled(),true);
  await page.locator('#model-reset').click(); assert.equal(await page.locator('.model-card').count(),0);
  assert.deepEqual(errors, []);
  console.log('PASS: manual editing, disconnected/errors, mocked text+model AI, identity anchor across 4 views, review gate, model watermark, regeneration failure preservation, background edits, PNG export, 10-photo pagination, mobile/Pages paths. Live OpenAI was NOT called. Artifacts: ' + output);
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
