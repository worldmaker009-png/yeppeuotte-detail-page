import { apiRequest, analysisPhoto, checkAIResult } from './ai-client.js';
const $ = s => document.querySelector(s);
const labels = { front: '정면 전신', side: '측면 전신', full: '3/4 전신', upper: '상반신' };
export function createModelStudio({ getPhotos, isBusy, setBusy, health, onChange, applyText, refreshPreview }) {
  let models = [], anchor = null, stopRequested = false, attempts = 0, textAttempts = 0, usageTokens = 0, pricingTouched = false;
  const selected = () => models.filter(p => p.selected);
  const canSave = () => selected().every(p => p.approved);
  function estimate() {
    const imageUnit = Math.max(0, Math.min(100, Number($('#image-unit-cost').value) || 0));
    const textUnit = Math.max(0, Math.min(100, Number($('#text-unit-cost').value) || 0));
    const count = Number($('#model-count').value);
    $('#model-cost').textContent = `상품 1개 예상 예산: 약 $${(count * imageUnit + textUnit).toFixed(2)} USD (${count}컷 + 문구 1회) · 예시 단가 기준, 실제 청구액 아님. 이 화면의 요청 시도 ${attempts}컷 / 문구 ${textAttempts}회, 누적 가정 $${(attempts * imageUnit + textAttempts * textUnit).toFixed(2)}${usageTokens ? ` · 공급자 보고 ${usageTokens.toLocaleString()} 토큰` : ''}`;
  }
  function refresh() {
    $('#model-reset').hidden = !models.length && !anchor;
    $('#model-cancel').hidden = !isBusy() || !$('#model-generate').dataset.running;
    if (!$('#model-cancel').hidden) $('#model-cancel').disabled = false;
    $('#model-gallery').replaceChildren(...models.map((p, i) => {
      const card = document.createElement('div'); card.className = 'model-card';
      const img = document.createElement('img'); img.src = p.url; img.alt = `AI 가상 여성 모델 ${labels[p.view]}`;
      const title = document.createElement('h4'); title.textContent = `${labels[p.view]} · AI 가상 모델`;
      card.append(img, title);
      if (p === anchor) { const badge = document.createElement('small'); badge.className = 'anchor'; badge.textContent = '동일 인물 참조 기준'; card.append(badge); }
      for (const [key, text] of [['selected', '상세페이지에 사용'], ['approved', '원본과 의류 디테일 비교·검수 완료']]) {
        const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = p[key]; input.disabled = isBusy();
        input.setAttribute('aria-label', `${labels[p.view]} ${text}`);
        input.onchange = () => { p[key] = input.checked; onChange(); refresh(); }; label.append(input, text); card.append(label);
      }
      const actions = document.createElement('div'); actions.className = 'model-actions';
      for (const action of ['원본 비교', '앞으로', '재생성', 'PNG 저장', '삭제']) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = action; button.disabled = isBusy() || (action === '앞으로' && i === 0) || (action === 'PNG 저장' && !p.approved);
        button.setAttribute('aria-label', `${labels[p.view]} ${action}`);
        button.onclick = async () => {
          if (isBusy()) return;
          if (action === '원본 비교') { comparePhoto(p); return; }
          if (action === '재생성') return run(p.view);
          if (action === '앞으로') [models[i - 1], models[i]] = [models[i], models[i - 1]];
          if (action === '삭제') { models.splice(i, 1); URL.revokeObjectURL(p.url); }
          if (action === 'PNG 저장') { await savePhoto(p); return; }
          onChange(); refresh();
        }; actions.append(button);
      }
      card.append(actions); return card;
    }));
    estimate();
  }
  function comparePhoto(p) {
    const dialog = document.createElement('dialog'); dialog.className = 'compare-dialog';
    const heading = document.createElement('h3'); heading.textContent = '원본 의류와 AI 생성 사진 비교';
    const hint = document.createElement('p'); hint.textContent = '단추 수·패턴·색상·길이·실루엣을 확인하세요. 생성 사진만으로 실제 핏을 보장하지 않습니다.';
    const select = document.createElement('select'); select.setAttribute('aria-label', '비교할 원본 사진');
    getPhotos().forEach((photo, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `원본 ${i + 1} · ${photo.file.name}`; select.append(option); });
    const pair = document.createElement('div'); pair.className = 'compare-pair';
    const original = document.createElement('img'); original.alt = '원본 마네킹 상품 사진'; original.src = getPhotos()[0]?.url || '';
    const generated = document.createElement('img'); generated.alt = 'AI 가상 모델 생성 사진'; generated.src = p.url;
    select.onchange = () => { original.src = getPhotos()[Number(select.value)]?.url || ''; };
    pair.append(original, generated);
    const close = document.createElement('button'); close.textContent = '비교 닫기'; close.type = 'button'; close.onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove()); dialog.append(heading, hint, select, pair, close); document.body.append(dialog); dialog.showModal();
  }
  async function savePhoto(p) {
    const c = document.createElement('canvas'); c.width = p.image.naturalWidth; c.height = p.image.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(p.image, 0, 0);
    if ($('#ai-disclosure').checked) {
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(20, c.height - 65, 370, 40); ctx.fillStyle = '#414638'; ctx.font = '24px sans-serif'; ctx.fillText('AI 가상 모델 · 생성 이미지', 30, c.height - 37);
    }
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png')); c.width = 0;
    if (!blob) { $('#model-status').textContent = '모델 PNG 저장에 실패했습니다.'; return; }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `예쁘오뜨_AI가상모델_${p.view}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function resultPhoto(data) {
    if (data.source !== 'openai-images' || typeof data.image !== 'string' || !data.image.startsWith('data:image/png;base64,') || data.image.length > 24 * 1024 * 1024) throw new Error('실제 이미지 API의 PNG 응답을 확인할 수 없습니다.');
    const raw = atob(data.image.slice(data.image.indexOf(',') + 1));
    const blob = new Blob([Uint8Array.from(raw, c => c.charCodeAt(0))], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    try { const image = new Image(); image.src = url; await image.decode(); if (image.naturalWidth * image.naturalHeight > 16000000) throw new Error('size'); return { generated: true, image, url, view: data.view, selected: true, approved: false }; }
    catch { URL.revokeObjectURL(url); throw new Error('생성 사진을 읽을 수 없거나 크기가 너무 큽니다.'); }
  }
  async function run(singleView) {
    if (isBusy()) return;
    const status = $('#model-status'), originals = getPhotos();
    if (!$('#api-url').value.trim()) { status.textContent = '이미지 API 연결 필요 · 백엔드 HTTPS 주소를 먼저 설정해 주세요.'; return; }
    if (originals.length < 3 || originals.length > 10) { status.textContent = '마네킹 상품 사진 3~10장이 필요합니다.'; return; }
    if (!$('#ai-consent').checked) { status.textContent = '사진 사본의 외부 AI 전송 동의가 필요합니다.'; return; }
    const token = $('#admin-token').value;
    if (!token) { status.textContent = '관리자 접속 암호가 필요합니다. OpenAI 키를 브라우저에 입력하지 마세요.'; return; }
    if (singleView && singleView !== 'front' && !anchor) { status.textContent = '먼저 정면 모델 컷을 생성해 인물 참조 기준을 만들어 주세요.'; return; }
    const background = $('#model-background').value;
    const shootingStyle = $('model-shooting-style').value;
    const count = Number($('#model-count').value);
    const views = singleView ? [singleView] : count === 1 ? ['front'] : count === 2 ? ['front', 'upper'] : ['front', 'side', 'full', 'upper'];
    const shootingStyle = $('#model-shooting-style').value;stopRequested = false; $('#model-generate').dataset.running = 'true'; setBusy(true); $('#ai-progress').hidden = false;
    let completed = 0;
    try {
      status.textContent = '백엔드와 이미지 생성 설정 확인 중…'; const base = await health();
      const images = [];
      for (const [i, p] of originals.entries()) { status.textContent = `원본 의류 참조 준비 중 (${i + 1}/${originals.length})…`; images.push(await analysisPhoto(p.image)); }
      // Text is based exclusively on original garment photos, never on synthetic details.
      if (!singleView && !stopRequested) {
        status.textContent = '원본 의류의 종류·색상·디테일 분석 및 한국어 문구 생성 중…'; textAttempts++; estimate();
        const text = await apiRequest(base, '/generate', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ images }) });
        if (text.source !== 'openai') throw new Error('실제 텍스트 생성 결과를 확인하지 못했습니다.');
        await applyText(checkAIResult(text.result));
      }
      for (const [i, view] of views.entries()) {
        if (stopRequested) break;
        status.textContent = `모델 사진 생성 중 ${i + 1}/${views.length} · ${labels[view]} (컷당 수 분이 걸릴 수 있습니다)…`;
        const identity = anchor ? await analysisPhoto(anchor.image) : undefined;
        attempts++; estimate();
        const data = await apiRequest(base, '/model-image', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ images, view, background,shootingStyle, ...(identity ? { identity } : {}) }) });
        if (data.view !== view) throw new Error('요청한 구도와 응답이 일치하지 않습니다.');
        const p = await resultPhoto(data);
        if (!anchor) anchor = p;
        const existing = models.findIndex(m => m.view === view);
        if (existing === -1) models.push(p); else { const old = models[existing]; models[existing] = p; URL.revokeObjectURL(old.url); }
        if (Number.isFinite(data.usage?.total_tokens)) usageTokens += data.usage.total_tokens;
        completed++; onChange(); refresh(); await refreshPreview();
      }
      status.textContent = `${stopRequested ? '추가 생성 중단' : '실제 이미지 API 생성 완료'} · 이번 요청 ${completed}컷. 원본과 단추·색상·패턴·길이·실루엣을 비교하고 각 사진의 검수 완료를 체크한 뒤 상세페이지를 다시 만들어 저장하세요. 기준 인물은 초기화 전까지 유지됩니다.`;
    } catch (e) {
      status.textContent = `AI 제작 실패 · ${e.message} 이번 실행에서 완료한 ${completed}컷과 기존 결과는 유지됩니다. 자동 재시도하지 않습니다. 요청이 시작되었다면 실패·시간 초과에도 비용이 발생할 수 있습니다.`;
    } finally { delete $('#model-generate').dataset.running; $('#ai-progress').hidden = true; setBusy(false); refresh(); }
  }
  $('#model-generate').addEventListener('click', () => run());
  $('#model-cancel').addEventListener('click', () => { stopRequested = true; $('#model-status').textContent = '진행 중인 요청을 마친 뒤 다음 생성을 중단합니다. 시작한 요청의 비용은 취소되지 않습니다.'; });
  $('#model-reset').addEventListener('click', () => { if (isBusy()) return; models.forEach(p => URL.revokeObjectURL(p.url)); models = []; anchor = null; onChange(); refresh(); $('#model-status').textContent = '생성 모델과 인물 참조를 초기화했습니다. 원본 사진과 문구는 유지됩니다.'; });
  $('#model-count').addEventListener('input', estimate);
  for (const id of ['#image-unit-cost', '#text-unit-cost']) $(id).addEventListener('input', () => { pricingTouched = true; estimate(); });
  refresh();
  return { selected, canSave, refresh,
    recordTextAttempt: () => { textAttempts++; estimate(); },
    setPricing: value => {
      if (!pricingTouched && value && Number.isFinite(value.imageUSD) && Number.isFinite(value.textUSD)) { $('#image-unit-cost').value = value.imageUSD; $('#text-unit-cost').value = value.textUSD; estimate(); }
    },
    markReferencesChanged: () => { models.forEach(p => p.approved = false); refresh(); }
  };
}
