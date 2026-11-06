// Actual App/service/DeviceAdapter and actual public + built workers. Only auth,
// Firestore, backend and speech boundaries are synthetic; no live providers.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { installWorkerDiagnostics, workerCheckpoint } from './helpers/notification-worker-diagnostics.mjs';
import { loadNotificationWorkerAssets, workerScriptAsset } from './helpers/notification-worker-assets.mjs';

const stubs = {
  googleAuth: `
    const user = { uid: new URL(location.href).searchParams.get('identity') || 'synthetic-a', email: 'fixture@example.test', displayName: 'Fixture', getIdToken: async () => 'synthetic-id' };
    export const auth = { currentUser: user }, db = {}, WORKSPACE_SCOPES = [];
    export const initAuth = callback => { queueMicrotask(() => callback?.(user, 'synthetic-oauth')); return () => {}; };
    export const googleSignIn = async () => ({ user, accessToken: 'synthetic-oauth' });
    export const googleSignOut = async () => {}, setCachedAccessToken = () => {};
    export const getAccessToken = async () => 'synthetic-oauth', testFirestoreConnection = async () => {};`,
  firestoreSyncService: `
    export const syncUserProfileToFirestore = async () => {}, saveTaskToFirestore = async () => {}, deleteTaskFromFirestore = async () => {},
      saveEventToFirestore = async () => {}, deleteEventFromFirestore = async () => {};
    export const subscribeToUserTasks = () => () => {}, subscribeToUserEvents = () => () => {};`,
  speech: `
    export const playCyberTone = tone => window.fixtureTones.push(tone), stopSpeaking = () => {}, stopMicrophoneAnalyzer = () => {};
    export const speakKokoro = async (text, _voice, options) => { window.fixtureSpeech.push(text); options?.onEnd?.(); };
    export const setupMicrophoneAnalyzer = async () => null, getAudioContext = () => null;
    export const initSpeechRecognition = () => ({ start() {}, stop() {}, abort() {}, isSupported: false });`,
  backendApi: `
    export const backendFetch = async (input, init = {}) => {
      const path = new URL(input, location.origin).pathname;
      window.fixtureCalls.push({ path, method: init.method || 'GET' });
      if (path.startsWith('/api/push/')) return Response.json({ success: false, code: 'PUSH_DISABLED', realExecution: false }, { status: 503 });
      return Response.json({});
    };`,
};
const sourceRoot = process.cwd();
const workerAssets = await loadNotificationWorkerAssets(sourceRoot);
const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import App from './src/App'; import { SettingsModal } from './src/components/SettingsModal';
  import * as service from './src/services/pushNotificationService';
  import * as lifecycle from './src/services/serviceWorkerLifecycle';
  import { DeviceAdapter } from './src/core/adapters/DeviceAdapter';
  import { parseNaturalVoiceCommand } from './src/utils/rtLiteEngine';
  window.fixtureCalls = []; window.fixtureTones = []; window.fixtureSpeech = [];
  window.fixture = { service, lifecycle, DeviceAdapter, parseNaturalVoiceCommand };
  const settings = new URL(location.href).pathname === '/settings';
  createRoot(document.getElementById('root')).render(settings ? React.createElement(SettingsModal, {
    isOpen: true, initialSection: 'push', nvidiaApiKey: '', geminiApiKey: '', thirdPartyWebhookUrl: '',
    currentModel: 'rt-lite-local', selectedVoiceId: 'es_mateo', currentTheme: 'obsidian-cyan',
    onClose() {}, onOpenInstallModal() { window.installClicked = true; }
  }) : React.createElement(App));
`, resolveDir: sourceRoot }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  plugins: [{ name: 'synthetic-boundaries', setup(b) {
    b.onResolve({ filter: /\/(googleAuth|firestoreSyncService|backendApi|speech)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }] });
let flavor = 'legacy';
const legacy = `self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
// No policy acknowledgement: a previous installation must not be confirmed.
self.addEventListener('message', () => {});`;
let realExternalCalls = 0, cases = 0;
function scriptResponse(res, pathname, source, contents) {
  console.log(JSON.stringify({ checkpoint: 'worker-script-http', phase: flavor, path: pathname, source,
    status: 200, bytes: Buffer.byteLength(contents), sha256: createHash('sha256').update(contents).digest('hex') }));
  res.setHeader('Content-Type', 'text/javascript'); return res.end(contents);
}
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://fixture.test').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/sw.js' && flavor === 'legacy') return scriptResponse(res, pathname, 'synthetic legacy', legacy);
    if (pathname === '/sw.js' || pathname === '/sw-push.js' || pathname.startsWith('/workbox-')) {
      const asset = workerScriptAsset(workerAssets, flavor, pathname);
      if (!asset) {
        console.log(JSON.stringify({ checkpoint: 'fixture-script-not-found', phase: flavor, path: pathname, status: 404 }));
        res.writeHead(404); return res.end('Unknown fixture worker script');
      }
      return scriptResponse(res, pathname, asset.source, asset.body);
    }
    if (pathname.startsWith('/api/')) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, code: 'PUSH_DISABLED' }));
    }
    if (pathname === '/offline.html') { res.setHeader('Content-Type', 'text/html'); return res.end('<title>Offline</title>offline fixture'); }
    // Workbox precaches the actual build, including hashes, without external IO.
    const asset = resolve(sourceRoot, 'dist', '.' + pathname);
    if (asset.startsWith(resolve(sourceRoot, 'dist') + '/') && pathname !== '/index.html') {
      try {
        if ((await stat(asset)).isFile()) {
          const type = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[extname(asset)] || 'application/octet-stream';
          res.setHeader('Content-Type', type); return res.end(await readFile(asset));
        }
      } catch {}
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>G02 isolated fixture</title><div id="root"></div><script type="module">' + bundle.outputFiles[0].text + '</script>');
  } catch (error) { console.log(JSON.stringify({ checkpoint: 'fixture-http-error', phase: flavor, path: req.url, status: 500, code: error.code, error: error.message })); res.writeHead(500); res.end(error.message); }
});
let browser;
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
    headless: true, proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1' },
    args: ['--no-sandbox', '--disable-background-networking'] });
  console.log(JSON.stringify({ checkpoint: 'fixture-environment', node: process.version,
    platform: process.platform, arch: process.arch, browser: browser.version(), precacheEntries: workerAssets.precacheCount,
    buildRequired: true, workerCacheMode: 'updateViaCache:none / Cache-Control:no-store', contexts: 'fresh per scenario' }));
  async function isolatedContext() {
    const context = await browser.newContext();
    await installWorkerDiagnostics(context);
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      return route.abort('blockedbyclient');
    });
    context.on('requestfinished', request => { if (new URL(request.url()).origin !== base) realExternalCalls++; });
    await context.addInitScript(() => {
      const effects = window.notificationEffects = { permission: 0, subscribe: 0, unsubscribe: 0, show: 0, native: 0, schedule: 0, interval2000: 0 };
      const Original = window.Notification;
      window.Notification = class extends Original {
        constructor(...args) { effects.native++; super(...args); }
        static requestPermission() { effects.permission++; return Promise.resolve('granted'); }
        static get permission() { return 'granted'; }
      };
      ServiceWorkerRegistration.prototype.showNotification = async () => { effects.show++; };
      PushManager.prototype.subscribe = async () => { effects.subscribe++; return {}; };
      PushSubscription.prototype.unsubscribe = async () => { effects.unsubscribe++; return true; };
      const post = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function(data, ...rest) {
        if (['SHOW_BACKGROUND_NOTIFICATION', 'SCHEDULE_BACKGROUND_NOTIFICATION'].includes(data?.type)) effects.schedule++;
        return post.call(this, data, ...rest);
      };
      const interval = window.setInterval;
      window.setInterval = (callback, delay, ...args) => { if (delay === 2000) effects.interval2000++; return interval(callback, delay, ...args); };
      localStorage.setItem('vvc_liam_push_active', 'legacy-record');
      localStorage.setItem('unrelated-user-data', 'keep');
      localStorage.setItem('vvc_liam_model', 'rt-lite-local');
      const now = new Date();
      localStorage.setItem('vvc_liam_tasks', JSON.stringify([{ id: 'due-fixture', title: 'synthetic due task',
        timeDue: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), dueDate: now.toISOString().split('T')[0],
        priority: 'critica', category: 'trabajo', isCompleted: false }]));
      for (const name of ['events','contacts','chat_history']) localStorage.setItem('vvc_liam_' + name, '[]');
    });
    return context;
  }
  for (const identity of ['synthetic-a', 'synthetic-b']) {
    console.log(JSON.stringify({ checkpoint: 'client', identity }));
    const context = await isolatedContext(), page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/?identity=' + identity); await page.waitForFunction(() => !!window.fixture);
    const input = page.getByPlaceholder(/^Escribe o dicta un comando/); await input.waitFor();
    await input.fill('Temporizador de 1 segundo'); await input.press('Enter');
    await page.getByText(/Temporizador de 1 segundo iniciado en tiempo real/).first().waitFor();
    await page.waitForTimeout(2300);
    const result = await page.evaluate(async () => {
      const { service, DeviceAdapter, parseNaturalVoiceCommand } = window.fixture;
      const permission = await service.requestNotificationPermission();
      const results = [await service.subscribeToPushNotifications(), await service.sendBackgroundAlert('synthetic'),
        await service.scheduleBackgroundAlert('synthetic', {}, 1), await service.testNativePushNotification()];
      const status = await service.getPushSubscriptionStatus();
      const device = new DeviceAdapter(); await device.requestNotificationPermission(); await device.showNotification('synthetic');
      const command = parseNaturalVoiceCommand('Probar notificación push en segundo plano', {}, []);
      return { permission, results, status, command, effects: window.notificationEffects, calls: window.fixtureCalls,
        tones: window.fixtureTones, speech: window.fixtureSpeech,
        legacy: localStorage.getItem('vvc_liam_push_active'), other: localStorage.getItem('unrelated-user-data') };
    });
    assert.deepEqual(errors, []);
    assert.ok(result.results.every(x => x.success === false && x.code === 'PUSH_DISABLED' && x.realExecution === false && x.outcome.status === 'unavailable'));
    assert.equal(result.permission, 'denied'); assert.equal(result.status.enabled, false); assert.equal(result.status.isSubscribed, null);
    assert.deepEqual(result.effects, { permission: 0, subscribe: 0, unsubscribe: 0, show: 0, native: 0, schedule: 0, interval2000: 0 });
    assert.equal(result.calls.filter(x => x.path.startsWith('/api/push/')).length, 0);
    assert.ok(!result.tones.some(t => t === 'alarm' || t === 'alert'));
    assert.ok(!result.speech.some(t => /recordatorio programado|temporizador.*finalizado/i.test(t)));
    assert.match(result.command.spokenResponse, /deshabilitadas/); assert.ok(!result.command.triggerPushTest);
    assert.equal(result.legacy, 'legacy-record'); assert.equal(result.other, 'keep'); cases++;
    await page.goto(base + '/settings?identity=' + identity);
    await page.getByText('Notificaciones deshabilitadas', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Habilitar Notificaciones|Probar Alerta|Probar en 5s|Re-sincronizar/ }).count(), 0);
    await page.getByRole('button', { name: 'Instalar App en Android / Generar APK' }).click();
    assert.equal(await page.evaluate(() => window.installClicked), true); cases++;
    await context.close();
  }
  // Real old-registration -> same URL update -> new controller acknowledgement.
  for (const target of ['public', 'built']) {
    console.log(JSON.stringify({ checkpoint: 'worker update', target }));
    flavor = 'legacy'; const context = await isolatedContext(), page = await context.newPage();
    await page.goto(base + '/settings'); await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      await (await caches.open('unrelated-user-cache')).put('/sentinel', new Response('keep-cache'));
      await (await caches.open('vvc-liam-core-cache-v1')).put('/old-sentinel', new Response('keep-legacy'));
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await workerCheckpoint(page, target + ':legacy-controlling');
    assert.equal(await page.evaluate(() => window.fixture.lifecycle.confirmDisabledWorker(navigator.serviceWorker.controller)), false);
    await workerCheckpoint(page, target + ':legacy-denied');
    flavor = target;
    page.on('console', message => { if (message.text().startsWith('[PWA]')) console.log(JSON.stringify({ checkpoint: 'pwa-console', target, text: message.text() })); });
    await page.evaluate(() => window.fixture.lifecycle.registerServiceWorker());
    await workerCheckpoint(page, target + ':register-returned');
    try {
      await page.waitForFunction(() => window.fixture.lifecycle.isDisabledWorkerConfirmed(), null, { timeout: 10000 });
    } catch (error) {
      await workerCheckpoint(page, target + ':confirmation-failed', true);
      throw error;
    }
    const confirmed = await workerCheckpoint(page, target + ':confirmation-passed', true);
    assert.equal(confirmed.policyProbe?.status, 'reply');
    assert.equal(confirmed.policyProbe?.revision, 'g02-notifications-disabled-v1');
    assert.equal(confirmed.policyProbe?.enabled, false);
    // An update can leave a terminated legacy Worker object in the list. Select
    // the live one by successfully probing the expected policy revision.
    let active;
    for (const candidate of context.serviceWorkers()) {
      try {
        if (await candidate.evaluate(() => typeof VVC_NOTIFICATION_POLICY_REVISION !== 'undefined')) active = candidate;
      } catch {}
    }
    assert.ok(active, 'new disabled worker is executing');
    const effects = await active.evaluate(() => {
      const counts = { show: 0, timers: 0, payload: 0, open: 0 };
      self.registration.showNotification = async () => { counts.show++; };
      const timer = self.setTimeout;
      self.setTimeout = (...args) => { counts.timers++; return timer(...args); };
      self.clients.openWindow = async () => { counts.open++; };
      self.dispatchEvent(new ExtendableMessageEvent('message', { data: { type: 'SCHEDULE_BACKGROUND_NOTIFICATION', delayMs: 1 } }));
      self.dispatchEvent(new ExtendableMessageEvent('message', { data: { type: 'SHOW_BACKGROUND_NOTIFICATION', title: 'synthetic' } }));
      const push = new Event('push'); Object.defineProperty(push, 'data', { get() { counts.payload++; return { json: () => ({ title: 'synthetic' }) }; } });
      self.dispatchEvent(push);
      const click = new Event('notificationclick'); Object.defineProperty(click, 'notification', { value: { close() {}, data: { url: 'https://forbidden.invalid' } } });
      self.dispatchEvent(click);
      return counts;
    });
    assert.deepEqual(effects, { show: 0, timers: 0, payload: 0, open: 0 }); cases++;
    const kept = await page.evaluate(async () => ({
      cache: await (await caches.match('/sentinel')).text(), old: await (await caches.match('/old-sentinel')).text(),
      storage: localStorage.getItem('vvc_liam_push_active'), other: localStorage.getItem('unrelated-user-data') }));
    assert.deepEqual(kept, { cache: 'keep-cache', old: 'keep-legacy', storage: 'legacy-record', other: 'keep' });
    await context.setOffline(true); await page.goto(base + '/never-cached-navigation');
    await page.getByText('offline fixture', { exact: true }).waitFor(); cases++;
    await workerCheckpoint(page, target + ':offline-and-data-preserved');
    await context.close();
  }
  assert.equal(realExternalCalls, 0);
  console.log(JSON.stringify({ fixture: 'G02 notification shutdown', result: 'PASS', cases, identities: 2,
    workers: ['public/sw.js', 'dist/sw.js + sw-push.js'], legacyUpdateAcknowledged: true,
    browser: browser.version(), realExternalCalls, realFirebaseAccounts: 0 }));
} finally {
  await browser?.close();
  if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
