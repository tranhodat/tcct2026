const assert = require('node:assert/strict');
const handler = require('../api/github.js');
const originalFetch = global.fetch;
Object.assign(process.env, { GITHUB_TOKEN: 'server-only-secret', EDIT_PASSWORD: 'test-password', GITHUB_REPO: 'owner/repo', GITHUB_BRANCH: 'main' });
let calls = [];
global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 201, json: async () => ({ content: { path: 'uploads/test.pdf' } }) }; };
async function request(overrides = {}) {
  const req = { method: 'PUT', headers: { 'x-edit-password': 'test-password' }, query: { path: 'uploads/test.pdf' }, body: { content: 'SGVsbG8=', branch: 'attacker' }, ...overrides };
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler(req, res); return res;
}
(async () => {
  const config = await request({ method: 'GET', headers: {}, query: { action: 'config' } });
  assert.equal(config.code, 200);
  assert.deepEqual(config.data, { repo: 'owner/repo', branch: 'main', configured: true });
  assert(!JSON.stringify(config.data).includes('server-only-secret'));
  assert.equal((await request({ headers: {} })).code, 401); assert.equal(calls.length, 0);
  assert.equal((await request({ query: { path: 'uploads/../config.js' } })).code, 400);
  assert.equal((await request({ query: { path: 'index.html' } })).code, 400);
  const result = await request(); assert.equal(result.code, 201);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer server-only-secret');
  assert.equal(JSON.parse(calls[0].options.body).branch, 'main');
  assert(!JSON.stringify(result.data).includes('server-only-secret'));
  assert.equal((await request({ body: { content: 'A'.repeat(4 * 1024 * 1024 + 4) } })).code, 413);
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }) });
  assert.equal((await request()).code, 401);
  delete process.env.GITHUB_TOKEN;
  assert.equal((await request()).code, 503);
  console.log('PASS: server authentication, path restrictions, server-only token, branch enforcement, size limit, upstream 401 and missing environment.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
