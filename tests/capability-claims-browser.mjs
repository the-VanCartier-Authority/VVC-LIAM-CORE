// Real production UI; external requests and notification/audio permissions are blocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startApp } from './server-helper.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const app = await startApp(); let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === app.base ? route.continue() : route.abort());
  await page.goto(app.base, { waitUntil: 'networkidle' });
  const vaultE2eeLinks = await page.getByRole('button', { name: 'Bóveda E2EE', exact: true }).count();
  await page.getByRole('button', { name: 'Docs & PDF', exact: true }).click();
  const content = await page.locator('textarea').first().inputValue();
  const templateMarked = content.includes('EJEMPLO') && content.includes('No contiene mediciones');
  const fictionalCertification = /99\.98%|45ms|100% calibrados|verificado sin anomalías|Todos los subsistemas permanecen sincronizados/.test(content);
  await page.goto(app.base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Gmail', exact: true }).click();
  const gmailE2eeBadges = await page.getByText('OAUTH E2EE', { exact: true }).count();
  await page.goto(app.base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Agenda & Tareas', exact: true }).click();
  const calendarE2eeBadges = await page.getByText('Sincronización RFC 5545 iCal & E2EE', { exact: true }).count();
  console.log(JSON.stringify({ browser: browser.version(), vaultE2eeLinks, templateMarked, fictionalCertification,
    gmailE2eeBadges, calendarE2eeBadges, realExternalCalls: 0 }));
  assert.equal(vaultE2eeLinks, 0);
  assert.equal(templateMarked, true); assert.equal(fictionalCertification, false);
  assert.equal(gmailE2eeBadges, 0); assert.equal(calendarE2eeBadges, 0);
} finally { await browser?.close(); await app.stop(); }
