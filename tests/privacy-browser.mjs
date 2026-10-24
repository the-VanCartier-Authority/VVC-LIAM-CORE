// Manual browser regression. Install playwright-core temporarily; external I/O is blocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startApp } from './server-helper.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const app = await startApp();
let browser;
const blocked = new Set();
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== app.base) { blocked.add(url.hostname); return route.abort(); }
    if (url.pathname === '/api/tts') return route.fulfill({ json: { fallback: true } });
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('vvc_liam_chat_history', JSON.stringify([{ id: 'privacy-fixture', sender: 'assistant',
      text: 'fixture plaintext', timestamp: '00:00', isE2EE: true }]));
    speechSynthesis.speak = () => {};
  });
  await page.goto(app.base, { waitUntil: 'networkidle' });
  assert.ok(await page.getByText('fixture plaintext', { exact: true }).count());
  const encryptionBadges = await page.getByText('E2EE', { exact: true }).count();
  assert.equal(encryptionBadges, 0, 'plaintext/history and the UI cannot claim E2EE');
  console.log(JSON.stringify({ browser: browser.version(), plaintextFixtureRendered: true, encryptionBadges,
    externalHostsBlocked: [...blocked], realProviderCalls: 0 }));
} finally { await browser?.close(); await app.stop(); }
