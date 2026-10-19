import { makeCopy, priceLabel, safeFilename } from './content.js';
const $ = s => document.querySelector(s);
const form = $('#product-form');
const status = $('#status');
let photos = [], pages = [], product, busy = false, dirty = true, urls = [];
function invalidate() { dirty = true; clearDownloads(); $('#download').disabled = true; if (product) status.textContent = '상품 정보가 변경되었습니다. 다시 생성해 주세요.'; }
form.addEventListener('input', invalidate);
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
        if (action === '삭제') { URL.revokeObjectURL(p.url); photos.splice(i, 1); }
        else [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
        invalidate(); showPhotos();
      }; actions.append(button);
    }
    card.append(img, actions); return card;
  }));
}
$('#photos').addEventListener('change', async event => {
  if (busy) return;
  busy = true; $('#generate').disabled = true;
  const errors = [];
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
    invalidate(); status.textContent = errors.join('\n') || '사진이 추가되었습니다. 상세페이지를 생성해 주세요.';
  } finally { event.target.value = ''; busy = false; $('#generate').disabled = false; showPhotos(); }
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
  const selectedProduct = { ...product }, selectedPhotos = [...photos];
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
    blocks.push({ height, draw(c, y) { c.fillStyle = '#faf9f6'; c.fillRect(0, y, 860, height); c.drawImage(p.image, (860 - width) / 2, y, width, height); } });
  }
  text('Y E P P E U O T T E', 30, 52, '#f6f5ef'); text('일상의 아름다움을 담다', 21, 14, '#f6f5ef', '#8b8d7e');
  text(selectedProduct.name, 42, 48); text(priceLabel(selectedProduct.price), 28, 16); photo(selectedPhotos[0]);
  text('A BEAUTIFUL EVERYDAY', 22, 55, '#f6f5ef', '#868c75'); text(description, 27, 45, '#f6f5ef');
  if (selectedPhotos.length > 1) text('DETAIL VIEW', 24, 50);
  selectedPhotos.slice(1).forEach(p => { photo(p); text('', 10, 12); });
  text('PRODUCT INFORMATION', 26, 50);
  for (const [label, value] of [['상품명', selectedProduct.name], ['가격', priceLabel(selectedProduct.price)], ['소재', selectedProduct.material], ['색상', selectedProduct.colors], ['사이즈', selectedProduct.sizes]]) text(`${label}  |  ${value}`, 25, 22, '#f7f7f3');
  text('구매 전 확인해 주세요\n모니터 및 조명에 따라 실제 색상과 차이가 있을 수 있습니다.\n사이즈 표기는 측정 방법에 따라 차이가 있을 수 있습니다.', 21, 55, '#fff', '#8c8e82');
  text('YEPPEUOTTE\n당신의 일상에 더하는 작은 아름다움', 25, 60, '#f0f1e9');
  const groups = [[]]; let height = 0;
  for (const block of blocks) { if (height + block.height > 10000 && groups.at(-1).length) { groups.push([]); height = 0; } groups.at(-1).push(block); height += block.height; }
  const next = groups.map((group, i) => {
    const canvas = document.createElement('canvas'); canvas.width = 860; canvas.height = group.reduce((sum, b) => sum + b.height, 0);
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${selectedProduct.name} 상세페이지 ${i + 1}`);
    const c = canvas.getContext('2d'); if (!c) throw Error('canvas'); let y = 0;
    group.forEach(b => { b.draw(c, y); y += b.height; }); return canvas;
  });
  pages.forEach(c => { c.width = 0; c.height = 0; }); pages = next;
  clearDownloads(); $('#canvases').replaceChildren(...pages); $('#canvases').hidden = false; $('#empty').style.display = 'none';
  dirty = false; $('#download').disabled = false;
  status.textContent = `상세페이지가 생성되었습니다. PNG ${pages.length}장 · 가로 860px\n소개 문구를 직접 수정할 수 있습니다.`;
}
async function generate(description) {
  if (busy) return;
  busy = true; $('#generate').disabled = true; $('#apply-copy').disabled = true; $('#download').disabled = true;
  // Prevent changes during async font loading so preview and form remain in sync.
  const inputs = [...form.querySelectorAll('input'), $('#description')]; inputs.forEach(input => input.disabled = true); showPhotos();
  try { await render(description); }
  catch { status.textContent = '생성에 실패했습니다. 사진 크기나 개수를 줄여 다시 시도해 주세요.'; }
  finally { busy = false; inputs.forEach(input => input.disabled = false); $('#generate').disabled = false; $('#apply-copy').disabled = false; showPhotos(); }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  if (!photos.length) { status.textContent = '상품 사진을 한 장 이상 추가해 주세요.'; $('#photos').focus(); return; }
  const data = Object.fromEntries(new FormData(form));
  for (const key of ['name', 'material', 'colors', 'sizes']) {
    data[key] = data[key].trim();
    if (!data[key]) { status.textContent = '필수 항목에 공백만 입력할 수 없습니다.'; form.elements[key].focus(); return; }
  }
  product = data; $('#description').value = makeCopy(product); $('#copy-editor').hidden = false;
  await generate($('#description').value);
});
$('#apply-copy').addEventListener('click', async () => {
  if (dirty) { status.textContent = '상품 정보가 변경되었습니다. 다시 생성해 주세요.'; return; }
  if (!$('#description').value.trim()) { status.textContent = '소개 문구를 입력해 주세요.'; return; }
  await generate($('#description').value.trim());
});
function clearDownloads() { $('#download-links')?.remove(); urls.forEach(url => URL.revokeObjectURL(url)); urls = []; }
$('#download').addEventListener('click', async () => {
  if (busy) return;
  busy = true; $('#download').disabled = true;
  const controls = [...form.querySelectorAll('input, button'), $('#description'), $('#apply-copy')];
  controls.forEach(control => control.disabled = true); showPhotos();
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
  finally { busy = false; controls.forEach(control => control.disabled = false); showPhotos(); $('#download').disabled = dirty; }
});
