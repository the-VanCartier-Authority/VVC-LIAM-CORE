// Real CalendarRemindersModal in Chromium. Google boundaries are fixtures; external hosts blocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs').href);
const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import { CalendarRemindersModal } from './src/components/CalendarRemindersModal';
  window.fixtureTasks = []; window.fixtureEvents = []; window.fixtureGoogle = [];
  function Fixture() {
    const [events, setEvents] = React.useState([]); window.fixtureSetEvents = setEvents;
    return React.createElement(CalendarRemindersModal, { isOpen: true, onClose() {}, events, tasks: [],
      onAddEvent(event) { window.fixtureEvents.push(event); setEvents(previous => [...previous, { ...event, id: 'fixture-' + previous.length }]); },
      onAddTask(task) { window.fixtureTasks.push(task); }, onDeleteEvent() {}, onToggleTask() {}, onUpdateTask() {},
      onDeleteTask() {}, onConvertTaskToEvent() {}, onUpdateWebhookUrl() {}, thirdPartyWebhookUrl: '', currentUser: { uid: 'fixture' } });
  }
  createRoot(document.getElementById('root')).render(React.createElement(Fixture));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture-boundaries', setup(b) {
    b.onResolve({ filter: /\/(googleAuth|googleCalendarService)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'googleAuth'
      ? `export const getAccessToken = async () => 'synthetic-oauth';`
      : `export const listGoogleCalendarEvents = async () => [];
         export const createGoogleCalendarEvent = async (_token, body) => { window.fixtureGoogle.push(body); };
         export const deleteGoogleCalendarEvent = async () => {};`, loader: 'js' }));
  } }] });
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><div id="root"></div><script type="module">' + bundle.outputFiles[0].text + '</script>'); });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ timezoneId: 'America/Los_Angeles' }), errors = [];
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.clock.install({ time: new Date('2026-10-24T06:30:00Z') });
  await page.goto(base);
  const taskForm = page.locator('form').first();
  assert.equal(await taskForm.locator('[type=date]').inputValue(), '2026-10-23');
  await taskForm.getByPlaceholder('Título de la tarea o recordatorio...').fill('Fixture tarea');
  await taskForm.locator('[type=date]').fill('2026-11-01'); await taskForm.locator('[type=time]').fill('01:30');
  await page.getByRole('textbox', { name: 'Zona horaria de la tarea', exact: true }).fill('America/New_York');
  await taskForm.getByRole('button', { name: 'Guardar & Programar' }).click();
  assert.equal(await page.evaluate(() => window.fixtureTasks.length), 0);
  assert.match(await page.getByRole('alert').first().innerText(), /se repite/);
  await taskForm.locator('[type=time]').fill('03:30');
  await taskForm.getByRole('button', { name: 'Guardar & Programar' }).click();
  assert.equal(await page.evaluate(() => window.fixtureTasks[0].dueAt), '2026-11-01T08:30:00.000Z');

  await page.getByRole('button', { name: /^Agenda Local/ }).click();
  const eventForm = page.locator('form').first();
  await eventForm.getByPlaceholder('Título de la reunión o evento...').fill('Fixture nocturna');
  await eventForm.locator('[type=date]').first().fill('2026-10-24');
  await eventForm.locator('[type=time]').nth(0).fill('23:30'); await eventForm.locator('[type=time]').nth(1).fill('00:30');
  await page.getByRole('textbox', { name: 'Zona horaria del evento', exact: true }).fill('UTC');
  await eventForm.getByRole('button', { name: 'Guardar Cita en Agenda' }).click();
  assert.equal(await page.evaluate(() => window.fixtureEvents[0].endDate), '2026-10-25');
  const google = page.getByRole('link', { name: 'Google', exact: true });
  assert.equal(new URL(await google.getAttribute('href')).searchParams.get('dates'), '20261024T233000Z/20261025T003000Z');
  await page.evaluate(() => window.fixtureSetEvents([{ id: 'invalid', title: 'Registro inválido', date: '2026-02-31', time: '10:00' }]));
  await page.getByText('Registro inválido', { exact: true }).waitFor();
  assert.equal(await page.locator('a[aria-disabled="true"]').filter({ hasText: /^Google$/ }).getAttribute('href'), null);
  assert.equal(await eventForm.getByRole('button', { name: 'Guardar Cita en Agenda' }).isDisabled(), true);

  await page.getByRole('button', { name: 'Google Calendar (API)' }).click();
  const gForm = page.locator('form').first();
  await gForm.getByPlaceholder('Título del evento en Google...').fill('Fixture Google');
  await gForm.locator('[type=date]').fill('2026-03-08'); await gForm.locator('[type=time]').nth(0).fill('02:30');
  await gForm.locator('[type=time]').nth(1).fill('03:30');
  await page.getByRole('textbox', { name: 'Zona horaria para Google', exact: true }).fill('America/New_York');
  await gForm.locator('[type=submit]').click();
  assert.equal(await page.evaluate(() => window.fixtureGoogle.length), 0);
  await gForm.locator('[type=date]').fill('2026-11-02');
  await gForm.locator('[type=time]').nth(0).fill('23:30'); await gForm.locator('[type=time]').nth(1).fill('00:30');
  await gForm.locator('[type=submit]').click();
  await page.waitForFunction(() => window.fixtureGoogle.length === 1);
  const captured = await page.evaluate(() => window.fixtureGoogle[0]);
  assert.equal(captured.startDateTime, '2026-11-03T04:30:00.000Z');
  assert.equal(captured.endDateTime, '2026-11-03T05:30:00.000Z');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: browser.version(), localDefaultDay: '2026-10-23',
    ambiguousTaskRejected: true, gapGoogleRejected: true, overnightEventCorrect: true,
    invalidLegacyRecordVisibleWithoutLink: true, mockGoogleInterval: captured, errors, realGoogleCalls: 0, realProviderCalls: 0 }));
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
