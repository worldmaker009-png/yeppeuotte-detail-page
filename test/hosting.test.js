import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('GitHub Pages 저장소 하위 경로에서 모든 HTML 자산 로드 가능', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const base = new URL('https://worldmaker009-png.github.io/yeppeuotte-detail-page/');
  const assets = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  assert.ok(assets.includes('./app.js'));
  assert.ok(assets.includes('./style.css'));
  for (const asset of assets) {
    const url = new URL(asset, base);
    assert.ok(url.href.startsWith(base.href), `저장소 경로를 벗어난 자산: ${asset}`);
    if (asset !== './') await access(new URL('../public/' + asset, import.meta.url));
  }
});
