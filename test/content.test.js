import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCopy, priceLabel, safeFilename } from '../public/content.js';
test('소개 문구에 입력한 상품명, 소재, 색상 반영', () => {
  const copy = makeCopy({ name: '라운드 니트', material: '면 100%', colors: '크림, 블랙' });
  for (const value of ['라운드 니트', '면 100%', '크림, 블랙']) assert.ok(copy.includes(value));
  assert.ok(!copy.includes('undefined'));
});
test('원화 가격과 무료 상품 표기', () => { assert.equal(priceLabel('39000'), '39,000원'); assert.equal(priceLabel(0), '0원'); });
test('저장 파일명 경로 및 금지 문자 제거', () => { assert.equal(safeFilename('니트/블랙:*?'), '니트_블랙____상세페이지'); assert.equal(safeFilename('   '), '상품_상세페이지'); });
