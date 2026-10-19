export function normalizeApiUrl(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('백엔드 주소는 경로·쿼리 없이 입력해 주세요.');
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('백엔드에는 HTTPS 주소를 사용해야 합니다.');
  return url.origin;
}
export function checkAIResult(value) {
  if (!value || typeof value !== 'object') throw new Error('AI 결과 형식이 올바르지 않습니다.');
  for (const [key, max] of Object.entries({ name: 100, category: 80, introduction: 1200, visualMaterial: 500 })) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max || value[key].split('\n').length > 30) throw new Error('AI 결과 문구를 확인할 수 없습니다.');
  }
  for (const [key, max, length] of [['colors', 10, 80], ['designPoints', 6, 200], ['styling', 5, 250]]) {
    if (!Array.isArray(value[key]) || !value[key].length || value[key].length > max || value[key].some(v => typeof v !== 'string' || !v.trim() || v.length > length || v.includes('\n'))) throw new Error('AI 결과 목록을 확인할 수 없습니다.');
  }
  return value;
}
export async function apiRequest(base, path, options = {}) {
  let response;
  const timeout = AbortSignal.timeout(path === '/model-image' ? 180000 : 75000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  try { response = await fetch(normalizeApiUrl(base) + path, { ...options, credentials: 'omit', cache: 'no-store', signal }); }
  catch { throw new Error('AI API 연결이 중단되었거나 시간이 초과되었습니다. 이미 시작한 생성에는 비용이 발생할 수 있습니다. HTTPS 주소·CORS·사용량을 확인해 주세요.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('AI API가 올바른 JSON 응답을 반환하지 않았습니다.'); }
  if (!response.ok) throw new Error(data.error?.message || 'AI 요청에 실패했습니다. 백엔드 설정을 확인해 주세요.');
  return data;
}
export async function analysisPhoto(image) {
  // Derived JPEG removes metadata and reduces provider input; original files are untouched.
  const canvas = document.createElement('canvas');
  try {
    for (const [dimension, quality] of [[1440, .82], [1024, .65]]) {
      const ratio = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= 1024 * 1024) return await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('분석용 사진을 읽지 못했습니다.')); reader.readAsDataURL(blob);
      });
    }
    throw new Error('분석용 사진을 줄이지 못했습니다. 사진 크기를 줄여 주세요.');
  } finally { canvas.width = 0; canvas.height = 0; }
}
