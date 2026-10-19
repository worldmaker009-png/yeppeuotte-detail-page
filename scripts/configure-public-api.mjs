import { writeFile } from 'node:fs/promises';
import { normalizeApiUrl } from '../public/ai-client.js';
const input = process.env.AI_API_URL?.trim() || '';
const url = input ? normalizeApiUrl(input) : '';
if (url && !url.startsWith('https://')) throw new Error('Public deployment requires an HTTPS backend');
await writeFile(new URL('../public/config.js', import.meta.url), '// Public backend URL only; never credentials.\nexport const AI_API_URL = ' + JSON.stringify(url) + ';\n');
console.log(url ? 'Public backend URL configured (no credentials)' : 'Backend not configured; UI will explicitly show connection required');
