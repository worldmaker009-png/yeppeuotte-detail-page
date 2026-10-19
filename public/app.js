import { makeCopy, priceLabel, safeFilename } from './content.js';
import { AI_API_URL } from './config.js';
import { apiRequest, analysisPhoto, normalizeApiUrl, checkAIResult } from './ai-client.js';
import { createModelStudio } from './model-studio.js';
const $ = s => document.querySelector(s);
const form = $('#product-form');
const status = $('#status');
let photos = [], pages = [], product, busy = false, dirty = true, urls = [];
let provenance = '수동 입력';
function setBusy(value) {
  busy = value;
  document.querySelectorAll('.editor input, .editor textarea, .editor select, .editor button').forEach(el => { el.disabled = value; });
  $('#download').disabled = value || dirty || !modelStudio.canSave();
  showPhotos();
  modelStudio.refresh();
}
function invalidate() { dirty = true; clearDownloads(); $('#download').disabled = true; if (product) status.textContent = '상품 정보가 변경되었습니다. 다시 생성해 주세요.'; }
form.addEventListener('input', invalidate);
form.addEventListener('change', invalidate);
$('#description').addEventListener('input', () => { clearDownloads(); $('#download').disabled = true; status.textContent = '수정한 문구 적용 버튼을 눌러 주세요.'; });
function showPhotos() {
  $('#photo-count').textContent = `${photos.length} / 10`;
  $('#photo-list').replaceChildren(...photos.map((p, i) => {
    const card = document.createElement('div'); card.className = 'photo-card';
    const img = document.createElement('img'); img.src = p.url; img.alt = p.file.name;
    const actions = document.createElement('div'); actions.className = 'photo-actions';
    for (const action of ['앞으로', '삭제']) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = action === '앞으로' && i === 0 ? '대표' : action;
      button.disabled = busy || (action === '앞으로' && i === 0); button.setAttribute('aria-label', `${p.file.name} ${action}`);
      button.onclick = () => {
        if (busy) return;
        if (action === '삭제') { URL.revokeObjectURL(p.url); photos.splice(i, 1); modelStudio.markReferencesChanged(); }
        else [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
        invalidate(); showPhotos();
      }; actions.append(button);
    }
    card.append(img, actions); return card;
  }));
}
$('#photos').addEventListener('change', async event => {
  if (busy) return;
  setBusy(true);
  const errors = [];
  const previousCount = photos.length;
  try {
    for (const file of event.target.files) {
      if (photos.length >= 10) { errors.push('사진은 최대 10장까지 추가할 수 있습니다.'); break; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { errors.push(`${file.name}: 지원 형식과 15MB 제한을 확인해 주세요.`); continue; }
      const url = URL.createObjectURL(file);
      try {
        const image = new Image(); image.src = url; await image.decode();
        if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw Error('size');
        photos.push({ file, url, image });
      } catch { URL.revokeObjectURL(url); errors.push(`${file.name}: 읽을 수 없거나 4천만 화소를 초과하는 사진입니다.`); }
    }
    if (photos.length !== previousCount) modelStudio.markReferencesChanged();
    invalidate(); status.textContent = errors.join('\n') || '사진이 추가되었습니다. 상세페이지를 생성해 주세요.';
  } finally { event.target.value = ''; setBusy(false); }
});
const font = size => `${size}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
function wrap(ctx, text) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const char of paragraph) { if (line && ctx.measureText(line + char).width > 716) { lines.push(line); line = ''; } line += char; }
    lines.push(line);
  }
  return lines;
}
async function render(description) {
  const selectedProduct = { ...product }, selectedModels = modelStudio.selected(), selectedPhotos = [...selectedModels, ...photos];
  const scale = selectedProduct.resolution === '1' ? 1 : 2;
  const accent = { ivory: '#f6f5ef', sage: '#eef2e9', mono: '#eeeeec' }[selectedProduct.theme] || '#f6f5ef';
  await document.fonts.ready;
  const ctx = document.createElement('canvas').getContext('2d'), blocks = [];
  function text(text, size = 26, pad = 30, background = '#fff', color = '#414339') {
    ctx.font = font(size); const lines = wrap(ctx, text), lineHeight = size * 1.8, height = Math.ceil(pad * 2 + lines.length * lineHeight);
    blocks.push({ height, draw(c, y) {
      c.fillStyle = background; c.fillRect(0, y, 860, height); c.fillStyle = color; c.font = font(size); c.textAlign = 'center'; c.textBaseline = 'middle';
      lines.forEach((line, i) => c.fillText(line, 430, y + pad + lineHeight * (i + .5)));
    } });
  }
  function photo(p) {
    const height = Math.max(1, Math.round(Math.min(4000, 860 * p.image.naturalHeight / p.image.naturalWidth)));
    const width = Math.min(860, height * p.image.naturalWidth / p.image.naturalHeight);
    blocks.push({ height, draw(c, y) { c.fillStyle = '#faf9f6'; c.fillRect(0, y, 860, height); c.drawImage(p.image, (860 - width) / 2, y, width, height);
      if (p.generated && $('#ai-disclosure').checked) { c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(20, y + height - 48, 255, 32); c.fillStyle = '#42483d'; c.font = font(18); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('AI 가상 모델 · 생성 이미지', 30, y + height - 32); }
    } });
  }
  text('Y E P P E U O T T E', 30, 52, accent); text('일상의 아름다움을 담다', 21, 14, accent, '#8b8d7e');
  if (selectedProduct.category) text(selectedProduct.category, 21, 16);
  text(selectedProduct.name, 42, 48);
  if (selectedProduct.price !== '') text(priceLabel(selectedProduct.price), 28, 16);
  photo(selectedPhotos[0]);
  text('A BEAUTIFUL EVERYDAY', 22, 55, accent, '#868c75'); text(description, 27, 45, accent);
  if (selectedModels.length && $('#ai-disclosure').checked) text('AI 가상 모델 착용 이미지입니다.\n의류의 실제 색상과 디테일은 아래 원본 상품 사진을 확인해 주세요.', 20, 26, accent, '#767d6a');
  if (selectedProduct.designPoints) { text('DESIGN POINT', 24, 44); text(selectedProduct.designPoints, 26, 32, accent); }
  if (selectedProduct.visualMaterial) { text('VISUAL TEXTURE', 24, 44); text(selectedProduct.visualMaterial, 25, 30); }
  if (selectedProduct.styling) { text('STYLING NOTE', 24, 44); text(selectedProduct.styling, 26, 32, accent); }
  if (selectedPhotos.length > 1) text('DETAIL VIEW', 24, 50);
  selectedPhotos.slice(1).forEach(p => { if (selectedModels.length && p === photos[0]) text('ORIGINAL GARMENT · 실제 상품 사진', 23, 45); photo(p); text('', 10, 12); });
  text('PRODUCT INFORMATION', 26, 50);
  for (const [label, value] of [['상품명', selectedProduct.name], ['가격', selectedProduct.price === '' ? '판매자 확인 필요' : priceLabel(selectedProduct.price)], ['소재 성분', selectedProduct.material || '판매자 확인 필요'], ['색상', selectedProduct.colors || '판매자 확인 필요'], ['사이즈', selectedProduct.sizes || '판매자 확인 필요'], ['세탁 안내', selectedProduct.care || '제품 라벨 확인 필요']]) text(`${label}  |  ${value}`, 25, 22, '#f7f7f3');
  text('구매 전 확인해 주세요\n모니터 및 조명에 따라 실제 색상과 차이가 있을 수 있습니다.\n사이즈 표기는 측정 방법에 따라 차이가 있을 수 있습니다.', 21, 55, '#fff', '#8c8e82');
  text('YEPPEUOTTE\n당신의 일상에 더하는 작은 아름다움', 25, 60, '#f0f1e9');
  const groups = [[]]; let height = 0;
  for (const block of blocks) { if (height + block.height > 12000 / scale && groups.at(-1).length) { groups.push([]); height = 0; } groups.at(-1).push(block); height += block.height; }
  const next = groups.map((group, i) => {
    const canvas = document.createElement('canvas'); canvas.width = 860 * scale; canvas.height = group.reduce((sum, b) => sum + b.height, 0) * scale;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${selectedProduct.name} 상세페이지 ${i + 1}`);
    const c = canvas.getContext('2d'); if (!c) throw Error('canvas'); c.scale(scale, scale); let y = 0;
    group.forEach(b => { b.draw(c, y); y += b.height; }); return canvas;
  });
  pages.forEach(c => { c.width = 0; c.height = 0; }); pages = next;
  clearDownloads(); $('#canvases').replaceChildren(...pages); $('#canvases').hidden = false; $('#empty').style.display = 'none';
  dirty = false; $('#download').disabled = !modelStudio.canSave();
  $('#preview-resolution').textContent = `가로 ${860 * scale}px · ${pages.length}장 · ${provenance}`;
  status.textContent = `상세페이지가 생성되었습니다. PNG ${pages.length}장 · 가로 ${860 * scale}px\n${provenance} 기반 · 모든 문구를 직접 수정할 수 있습니다.`;
}
async function generate(description) {
  if (busy) return;
  setBusy(true);
  try { await render(description); }
  catch { status.textContent = '생성에 실패했습니다. 사진 크기나 개수를 줄여 다시 시도해 주세요.'; }
  finally { setBusy(false); }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  if (!photos.length) { status.textContent = '상품 사진을 한 장 이상 추가해 주세요.'; $('#photos').focus(); return; }
  const data = Object.fromEntries(new FormData(form));
  for (const key of ['introduction', 'designPoints', 'visualMaterial', 'styling']) {
    if (data[key].split('\n').length > 30) { status.textContent = '각 문구는 30줄 이하로 입력해 주세요.'; return; }
  }
  for (const key of ['name', 'material', 'colors', 'sizes']) {
    data[key] = data[key].trim();
    if (key === 'name' && !data[key]) { status.textContent = '상품명을 입력해 주세요.'; form.elements[key].focus(); return; }
  }
  product = data; $('#description').value = data.introduction.trim() || makeCopy(product); $('#copy-editor').hidden = false;
  await generate($('#description').value);
});
$('#apply-copy').addEventListener('click', async () => {
  if (dirty) { status.textContent = '상품 정보가 변경되었습니다. 다시 생성해 주세요.'; return; }
  if (!$('#description').value.trim()) { status.textContent = '소개 문구를 입력해 주세요.'; return; }
  if ($('#description').value.split('\n').length > 30) { status.textContent = '소개 문구는 30줄 이하로 입력해 주세요.'; return; }
  form.elements.introduction.value = $('#description').value.trim();
  await generate($('#description').value.trim());
});
function clearDownloads() { $('#download-links')?.remove(); urls.forEach(url => URL.revokeObjectURL(url)); urls = []; }
$('#download').addEventListener('click', async () => {
  if (busy) return;
  if (!modelStudio.canSave()) { status.textContent = '생성 모델 사진의 의류 디테일을 원본과 비교하고 검수 완료를 체크해 주세요.'; return; }
  setBusy(true);
  try {
    clearDownloads(); const links = document.createElement('div'); links.id = 'download-links';
    for (const [i, canvas] of pages.entries()) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw Error('export');
      const url = URL.createObjectURL(blob); urls.push(url);
      const link = document.createElement('a'); link.href = url; link.download = `${safeFilename(product.name)}_${String(i + 1).padStart(2, '0')}.png`;
      link.textContent = `PNG ${i + 1} 저장`; link.style.cssText = 'display:inline-block;margin:8px;color:#626d52'; links.append(link);
    }
    status.after(links); links.querySelectorAll('a').forEach(link => link.click());
    status.textContent = `${pages.length}장의 저장을 요청했습니다. 다운로드가 차단되면 아래 링크를 각각 눌러 주세요.`;
  } catch { status.textContent = 'PNG 저장에 실패했습니다. 사진을 줄여 다시 생성해 주세요.'; }
  finally { setBusy(false); }
});

$('#api-url').value = AI_API_URL;
async function health() {
  const base = normalizeApiUrl($('#api-url').value.trim());
  const data = await apiRequest(base, '/health');
  if (data.configured !== true) throw new Error('AI API 연결 필요 · 백엔드 API 키, 접속 암호, 요청 제한 설정이 필요합니다.');
  modelStudio.setPricing(data.estimate);
  $('#ai-connection').textContent = '백엔드 설정 확인됨 · 실제 AI 연결은 생성 요청 성공 시 확인됩니다.';
  return base;
}
$('#check-api').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try { await health(); }
  catch (e) { $('#ai-connection').textContent = 'AI API 연결 필요 · ' + e.message; }
  finally { setBusy(false); }
});
$('#api-url').addEventListener('input', () => { $('#ai-connection').textContent = 'AI API 연결 필요 · 변경한 주소의 설정을 확인해 주세요.'; });
async function generateAI() {
  if (busy) return;
  const aiStatus = $('#ai-status');
  if (!$('#api-url').value.trim()) { aiStatus.textContent = 'AI API 연결 필요 · 연결 설정에서 백엔드 HTTPS 주소를 입력해 주세요. 수동 제작은 계속 사용할 수 있습니다.'; return; }
  if (photos.length < 3 || photos.length > 10) { aiStatus.textContent = 'AI 분석에는 상품 사진 3~10장이 필요합니다.'; return; }
  if (!$('#ai-consent').checked) { aiStatus.textContent = '사진 사본의 외부 AI 전송 동의를 확인해 주세요.'; return; }
  const token = $('#admin-token').value;
  if (!token) { aiStatus.textContent = 'AI 연결 설정에 관리자 접속 암호를 입력해 주세요. OpenAI API 키를 입력하지 마세요.'; return; }
  setBusy(true); $('#ai-progress').hidden = false;
  try {
    aiStatus.textContent = '1/4 · 백엔드 설정 확인 중…';
    const base = await health();
    const images = [];
    for (const [i, photo] of photos.entries()) { aiStatus.textContent = `2/4 · 분석용 사진 준비 중 (${i + 1}/${photos.length})…`; images.push(await analysisPhoto(photo.image)); }
    aiStatus.textContent = '3/4 · AI가 사진과 디자인을 분석하고 한국어 문구를 생성 중입니다…';
    modelStudio.recordTextAttempt();
    const response = await apiRequest(base, '/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ images }) });
    if (response.source !== 'openai') throw new Error('실제 AI 생성 결과를 확인할 수 없습니다.');
    const result = checkAIResult(response.result);
    aiStatus.textContent = '4/4 · 예쁘오뜨 상세페이지 디자인 구성 중…';
    await applyAIText(result);
    $('#ai-regenerate').hidden = false;
    $('#ai-connection').textContent = '실제 AI 생성 요청 성공 · ' + new Date().toLocaleTimeString('ko-KR');
    aiStatus.textContent = 'AI 생성 완료 · 사진에서 보이는 특징만 분석했습니다. 문구·색상과 상품 정보를 검토하고 수정해 주세요. 소재 성분·실측·세탁 방법은 자동 생성하지 않았습니다.';
  } catch (e) {
    $('#ai-connection').textContent = 'AI 연결 확인 필요 · 마지막 생성 요청이 실패했습니다.';
    aiStatus.textContent = 'AI 생성 실패 · ' + e.message + ' 기존 입력과 미리보기는 유지됩니다.';
  } finally { $('#ai-progress').hidden = true; setBusy(false); }
}
$('#ai-generate').addEventListener('click', generateAI);
$('#ai-regenerate').addEventListener('click', generateAI);
async function applyAIText(result) {
  checkAIResult(result);
  const previousProduct = product, previousProvenance = provenance;
  const candidate = Object.fromEntries([...form.querySelectorAll('[name]')].map(control => [control.name, control.value]));
  for (const key of ['name', 'category', 'introduction', 'visualMaterial']) candidate[key] = result[key];
  candidate.colors = result.colors.join(', '); candidate.designPoints = result.designPoints.join('\n'); candidate.styling = result.styling.join('\n');
  product = candidate; provenance = 'AI 사진 분석 · 판매자 검토 필요';
  try { await render(result.introduction); } catch (e) { product = previousProduct; provenance = previousProvenance; throw e; }
  for (const control of form.querySelectorAll('[name]')) control.value = candidate[control.name];
  $('#description').value = result.introduction; $('#copy-editor').hidden = false; $('#ai-regenerate').hidden = false;
}
const modelStudio = createModelStudio({
  getPhotos: () => photos, isBusy: () => busy, setBusy, health, onChange: invalidate, applyText: applyAIText,
  refreshPreview: async () => {
    if (!form.elements.name.value.trim()) return;
    const next = Object.fromEntries([...form.querySelectorAll('[name]')].map(control => [control.name, control.value]));
    for (const key of ['introduction', 'designPoints', 'visualMaterial', 'styling']) if (next[key].split('\n').length > 30) throw new Error('각 문구를 30줄 이하로 줄여 주세요.');
    product = next; await render(next.introduction.trim() || makeCopy(next));
  }
});
$('#ai-disclosure').addEventListener('change', invalidate);
