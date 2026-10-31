// Native Chromium exercises the production authenticated transport, without a
// Firebase SDK/account. Cryptographic ID-token checks run in the HTTP/Node suite.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const bundle = await build({ stdin: { contents: `
  import { createAuthenticatedFetch } from './src/core/authenticatedFetch.ts';
  window.fixtureToken = 'synthetic-id-a';
  window.backendFixture = createAuthenticatedFetch(async () => window.fixtureToken, () => location.origin);
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm' });
const received = [], otherOriginRequests = [], blockedExternalRequests = [];
let browser, otherBase;
const other = createServer((req, res) => { otherOriginRequests.push(req.url); res.end('{}'); });
const app = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end('<!doctype html><title>B01 transport fixture</title><script type="module">' + bundle.outputFiles[0].text + '</script>');
  }
  if (req.url.startsWith('/api/')) received.push({ path: req.url, authorization: req.headers.authorization });
  if (req.url === '/api/redirect') res.writeHead(302, { Location: otherBase + '/api/stolen' });
  else res.setHeader('Content-Type', 'application/json');
  res.end('{}');
});
try {
  other.listen(0, '127.0.0.1'); await once(other, 'listening');
  otherBase = `http://127.0.0.1:${other.address().port}`;
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
    headless: true, args: ['--no-sandbox', '--disable-background-networking'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if ([base, otherBase].includes(origin)) return route.continue();
    blockedExternalRequests.push(origin); return route.abort('blockedbyclient');
  });
  const page = await context.newPage(); await page.goto(base, { waitUntil: 'load' });
  // 1. Caller-supplied OAuth/stale authorization is replaced.
  assert.equal(await page.evaluate(async () => (await window.backendFixture('/api/private', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-workspace-oauth' }
  })).status), 200);
  assert.equal(received.at(-1).authorization, 'Bearer synthetic-id-a');
  // 2. Resolve the current ID token again for each request.
  await page.evaluate(async () => { window.fixtureToken = 'synthetic-id-b'; await window.backendFixture('/api/private'); });
  assert.equal(received.at(-1).authorization, 'Bearer synthetic-id-b');
  // 3. Sign-out denies private requests before transmission.
  let count = received.length;
  await assert.rejects(page.evaluate(async () => { window.fixtureToken = null; await window.backendFixture('/api/private'); }), /AUTH_REQUIRED/);
  assert.equal(received.length, count);
  // 4. Explicit public GET remains usable without an ID token.
  assert.equal(await page.evaluate(async () => (await window.backendFixture('/api/config')).status), 200);
  assert.equal(received.at(-1).authorization, undefined);
  // 5. Another origin is rejected before fetch.
  count = received.length;
  await assert.rejects(page.evaluate(url => window.backendFixture(url), otherBase + '/api/private'), /BACKEND_ORIGIN_NOT_ALLOWED/);
  assert.equal(received.length, count); assert.deepEqual(otherOriginRequests, []);
  // 6. Native fetch refuses redirects without forwarding the token to origin B.
  await page.evaluate(() => { window.fixtureToken = 'synthetic-id-a'; });
  await assert.rejects(page.evaluate(() => window.backendFixture('/api/redirect')));
  assert.equal(received.length, count + 1); assert.deepEqual(otherOriginRequests, []);
  // 7. Userinfo and non-API paths are rejected before transmission.
  count = received.length;
  for (const url of [base.replace('://', '://user:synthetic@') + '/api/private', '/not-api'])
    await assert.rejects(page.evaluate(url => window.backendFixture(url), url), /BACKEND_ORIGIN_NOT_ALLOWED/);
  assert.equal(received.length, count); assert.deepEqual(blockedExternalRequests, []);
  console.log(JSON.stringify({ fixture: 'B01 authenticated transport', result: 'PASS', cases: 7,
    browser: browser.version(), otherOriginRequests: otherOriginRequests.length,
    blockedExternalRequests, realExternalCalls: 0, realFirebaseAccounts: 0 }));
} finally {
  await browser?.close();
  for (const server of [app, other]) if (server.listening) {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
