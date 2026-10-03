import worker from './src/index.js';
import assert from 'node:assert/strict';

const env = { ALLOWED_ORIGINS: 'https://ok.example,http://localhost:8766', DEEPL_KEY: 'abc:fx' };
const O = 'https://ok.example';
const post = (body, origin = O) => new Request('https://w.example/', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body),
});

let seen;
globalThis.fetch = async (url, init) => {
  seen = { url, init, body: JSON.parse(init.body) };
  return new Response(JSON.stringify({ translations: [{ text: 'Hallo\nWelt' }] }), { status: 200 });
};

// happy path
let r = await worker.fetch(post({ text: 'Cześć\nświat', source: 'pl' }), env);
assert.equal(r.status, 200);
assert.deepEqual(await r.json(), { text: 'Hallo\nWelt' });
assert.equal(r.headers.get('Access-Control-Allow-Origin'), O);
assert.equal(seen.url, 'https://api-free.deepl.com/v2/translate');
assert.equal(seen.init.headers.Authorization, 'DeepL-Auth-Key abc:fx');
assert.deepEqual([seen.body.source_lang, seen.body.target_lang, seen.body.text], ['PL', 'DE', ['Cześć\nświat']]);

// paid key -> paid host
await worker.fetch(post({ text: 'x', source: 'en' }), { ...env, DEEPL_KEY: 'abc' });
assert.equal(seen.url, 'https://api.deepl.com/v2/translate');

// preflight
r = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: O } }), env);
assert.equal(r.status, 204);

// rejections: wrong/missing origin, bad source, empty, too long, wrong method, bad json
seen = null;
assert.equal((await worker.fetch(post({ text: 'x', source: 'pl' }, 'https://evil.example'), env)).status, 403);
assert.equal((await worker.fetch(post({ text: 'x', source: 'pl' }, null), env)).status, 403);
assert.equal((await worker.fetch(post({ text: 'x', source: 'fr' }), env)).status, 400);
assert.equal((await worker.fetch(post({ text: '  ', source: 'pl' }), env)).status, 400);
assert.equal((await worker.fetch(post({ text: 'a'.repeat(4001), source: 'pl' }), env)).status, 400);
assert.equal((await worker.fetch(new Request('https://w.example/', { method: 'GET', headers: { Origin: O } }), env)).status, 405);
assert.equal((await worker.fetch(new Request('https://w.example/', { method: 'POST', headers: { Origin: O }, body: 'nope' }), env)).status, 400);
assert.equal(seen, null, 'DeepL must not be called for rejected requests');

// upstream failure -> 502 without leaking details
globalThis.fetch = async () => new Response('quota', { status: 456 });
r = await worker.fetch(post({ text: 'x', source: 'pl' }), env);
assert.equal(r.status, 502);
assert.ok(!JSON.stringify(await r.json()).includes('abc'));

console.log('worker tests passed');
