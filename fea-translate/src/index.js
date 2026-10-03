// Tiny proxy: the questionnaire page posts its free-text notes here, the Worker forwards them to
// DeepL with a secret API key (DEEPL_KEY) that never reaches the browser. Nothing is stored or logged.

const MAX_CHARS = 4000;
const SOURCES = { pl: 'PL', en: 'EN' };

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

const json = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return json({ error: 'forbidden' }, 403);
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'method' }, 405, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }
    const text = typeof body.text === 'string' ? body.text : '';
    const source = SOURCES[body.source];
    if (!text.trim() || text.length > MAX_CHARS || !source) return json({ error: 'bad request' }, 400, headers);
    if (!env.DEEPL_KEY) return json({ error: 'not configured' }, 500, headers);

    const host = env.DEEPL_KEY.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
    let res;
    try {
      res = await fetch(`https://${host}/v2/translate`, {
        method: 'POST',
        headers: { 'Authorization': `DeepL-Auth-Key ${env.DEEPL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: [text], source_lang: source, target_lang: 'DE', preserve_formatting: true }),
      });
    } catch { return json({ error: 'upstream' }, 502, headers); }
    if (!res.ok) return json({ error: 'upstream', status: res.status }, 502, headers);

    const out = await res.json();
    const translated = out && out.translations && out.translations[0] && out.translations[0].text;
    if (typeof translated !== 'string') return json({ error: 'upstream' }, 502, headers);
    return json({ text: translated }, 200, headers);
  },
};
