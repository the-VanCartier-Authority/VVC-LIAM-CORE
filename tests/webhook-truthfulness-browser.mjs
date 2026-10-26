// G01/D01: real Chromium fetch/CORS receipts, only loopback fixture servers.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const bundle = await build({ stdin: { contents: `
  import { dispatchTaskWebhook } from './src/utils/ical.ts';
  const task = { id: 'browser-fixture', title: 'synthetic task', dueDate: '2026-10-26',
    timeDue: '12:00', priority: 'alta', category: 'trabajo', isCompleted: false,
    recurrence: 'none', subtasks: [] };
  window.dispatchFixture = url => dispatchTaskWebhook(url, 'created', task);
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm' });
const app = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><title>D01 receipt fixture</title><script type="module">' + bundle.outputFiles[0].text + '</script>');
});
const received = [], blockedExternalRequests = [];
let browser, upstream;
try {
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const appBase = `http://127.0.0.1:${app.address().port}`;
  upstream = createServer(async (req, res) => {
    if (req.url !== '/cors-unreadable') {
      res.setHeader('Access-Control-Allow-Origin', appBase);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({ path: req.url, cookie: req.headers.cookie, authorization: req.headers.authorization,
      payload: JSON.parse(Buffer.concat(chunks).toString()) });
    if (req.url === '/redirect') res.writeHead(302, { Location: 'https://external.invalid/not-permitted' });
    else res.writeHead(req.url === '/forbidden' ? 403 : 202);
    res.end('synthetic-sensitive-response');
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const upstreamBase = `http://127.0.0.1:${upstream.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
    headless: true, args: ['--no-sandbox', '--disable-background-networking'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.addCookies([{ name: 'fixture-session', value: 'synthetic-cookie', url: upstreamBase }]);
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if ([appBase, upstreamBase].includes(origin)) return route.continue();
    blockedExternalRequests.push(origin); return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  await page.goto(appBase, { waitUntil: 'load', timeout: 10000 });
  const results = {};
  for (const path of ['/forbidden', '/accepted', '/cors-unreadable', '/redirect'])
    results[path] = await page.evaluate(url => window.dispatchFixture(url), upstreamBase + path);
  const beforeInvalid = received.length;
  results.invalid = await page.evaluate(url => window.dispatchFixture(url), 'https://user:synthetic@external.invalid/hook');
  console.log(JSON.stringify({ browser: browser.version(), results, observedPosts: received.length,
    blockedExternalRequests, realExternalCalls: 0 }));
  assert.equal(results['/forbidden'].success, false);
  assert.equal(results['/forbidden'].status, 403);
  assert.equal(results['/forbidden'].delivery, 'failed');
  assert.equal(results['/accepted'].success, true);
  assert.equal(results['/accepted'].status, 202);
  assert.equal(results['/accepted'].delivery, 'accepted');
  for (const path of ['/cors-unreadable', '/redirect']) {
    assert.equal(results[path].success, false); assert.equal(results[path].delivery, 'unverified');
    assert.equal(results[path].status, undefined);
  }
  assert.equal(results.invalid.delivery, 'not_attempted'); assert.equal(received.length, beforeInvalid);
  for (const result of Object.values(results)) {
    assert.equal(result.realExecution, false); assert.notEqual(result.outcome.status, 'executed');
    assert.doesNotMatch(JSON.stringify(result), /synthetic-sensitive-response/);
  }
  assert.equal(received.length, 3); // CORS preflight blocks the unreadable endpoint's POST.
  for (const request of received) {
    assert.equal(request.cookie, undefined); assert.equal(request.authorization, undefined);
    assert.equal(request.payload.event, 'vvc_liam.task.created');
    assert.equal(request.payload.task.id, 'browser-fixture');
  }
  assert.deepEqual(blockedExternalRequests, [], 'redirect must not even attempt an external destination');
  console.log(JSON.stringify({ result: 'PASS', fixtures: 1, cases: 5, realExternalCalls: 0 }));
} finally {
  await browser?.close();
  for (const server of [upstream, app]) if (server?.listening) {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
