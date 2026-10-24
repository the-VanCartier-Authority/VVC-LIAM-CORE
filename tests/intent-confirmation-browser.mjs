// Real App + mocked boundaries. No actual Firebase, voice, push or provider calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs').href);

const stubs = {
  googleAuth: `
    const user = { uid: 'fixture-a', email: 'fixture@example.test', displayName: 'Fixture', getIdToken: async () => 'synthetic-id' };
    export const auth = { currentUser: user }, db = {}, WORKSPACE_SCOPES = [];
    export const initAuth = (callback, failure) => {
      window.fixtureReplaceIdentitySilently = () => { auth.currentUser = { ...auth.currentUser }; };
      window.fixtureSwitchIdentity = uid => { auth.currentUser = uid ? { ...user, uid } : null;
        if (auth.currentUser) callback?.(auth.currentUser, 'synthetic-oauth'); else failure?.(); };
      queueMicrotask(() => callback?.(user, 'synthetic-oauth')); return () => {}; };
    export const googleSignIn = async () => ({ user, accessToken: 'synthetic-oauth' });
    export const googleSignOut = async () => {}, setCachedAccessToken = () => {};
    export const getAccessToken = async () => 'synthetic-oauth', testFirestoreConnection = async () => {};`,
  firestoreSyncService: `
    export const syncUserProfileToFirestore = async () => {}, saveTaskToFirestore = async () => {}, deleteTaskFromFirestore = async () => {},
      saveEventToFirestore = async () => {}, deleteEventFromFirestore = async () => {};
    export const subscribeToUserTasks = () => () => {}, subscribeToUserEvents = () => () => {};`,
  pushNotificationService: `
    export const isServiceWorkerSupported = () => false, isPushSupported = () => false, getNotificationPermission = () => 'denied';
    export const initNotificationClickListener = () => () => {};
    export const registerServiceWorker = async () => null, getServiceWorkerRegistration = async () => null,
      requestNotificationPermission = async () => 'denied', fetchVapidPublicKey = async () => null,
      subscribeToPushNotifications = async () => ({ success: false }), unsubscribeFromPushNotifications = async () => true,
      getPushSubscriptionStatus = async () => ({ isSupported: false }), sendBackgroundAlert = async () => {},
      scheduleBackgroundAlert = async () => {}, testNativePushNotification = async () => ({ success: false });`,
  speech: `
    export const playCyberTone = () => {}, stopSpeaking = () => {}, stopMicrophoneAnalyzer = () => {};
    export const speakKokoro = async (_text, _voice, options) => options?.onEnd?.();
    export const setupMicrophoneAnalyzer = async () => null, getAudioContext = () => null;
    export const initSpeechRecognition = () => ({ start() {}, stop() {}, abort() {}, isSupported: false });`,
  backendApi: `
    export const backendFetch = async (input, init = {}) => {
      const path = new URL(input, location.origin).pathname;
      window.fixtureCalls.push({ path, body: init.body ? JSON.parse(init.body) : null });
      if (path === '/api/vaos/dispatch') return Response.json({ route: 'ASYNC_PATH', policyApproved: true,
        asyncTask: { taskId: 'fixture-hidden-generation', pollUrl: '/api/vaos/task/fixture-hidden-generation' } });
      if (path.startsWith('/api/chat/')) return Response.json({ choices: [{ message: { content: 'fixture-visible-generation' } }], model_used: 'fixture/model' });
      return Response.json({});
    };`,
};
const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './src/App';
  window.fixtureCalls = []; window.fixtureHandoffs = []; createRoot(document.getElementById('root')).render(React.createElement(App));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'isolated-boundaries', setup(b) {
    b.onLoad({ filter: /\/src\/App\.tsx$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      const marker = 'window.location.href = `tel:${clean}`;';
      if (!source.includes(marker)) throw Error('Expected dialer boundary missing');
      return { contents: source.replace(marker, 'window.fixtureHandoffs.push(clean);'), loader: 'tsx', resolveDir: process.cwd() + '/src' };
    });
    b.onResolve({ filter: /\/(googleAuth|firestoreSyncService|pushNotificationService|backendApi|speech)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }] });
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><div id="root"></div><script type="module">' + bundle.outputFiles[0].text + '</script>'); });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('vvc_liam_model', 'google/gemma-4-31b-it');
    localStorage.setItem('vvc_secret_nvidia_api_key', 'synthetic-nim');
    localStorage.setItem('vvc_liam_tasks', '[]'); localStorage.setItem('vvc_liam_events', '[]');
    localStorage.setItem('vvc_liam_contacts', JSON.stringify([{ id: 'fixture-a', name: 'Ada', phone: '+15550000001' }])); localStorage.setItem('vvc_liam_chat_history', '[]');
  });
  await page.goto(base);
  await page.waitForTimeout(500);
  if (errors.length) throw new Error(JSON.stringify({ fixturePageErrors: errors }));
  const input = page.getByPlaceholder(/^Escribe o dicta un comando/);
  await input.waitFor({ timeout: 5000 });
  const ask = async () => { await input.fill('llamar a ada'); await input.press('Enter'); await page.waitForTimeout(100); };
  await ask();
  const dialog = page.getByRole('dialog', { name: 'Confirmar acción sensible' });
  const before = await page.evaluate(() => window.fixtureHandoffs);
  console.log(JSON.stringify({ browser: browser.version(), beforeConfirmationHandoffs: before.length,
    confirmationVisible: await dialog.count(), errors, realExternalCalls: 0 }));
  assert.deepEqual(errors, []); assert.deepEqual(before, []); assert.equal(await dialog.count(), 1);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.fixtureHandoffs), []);
  await ask();
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Cancelar');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Confirmar');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.fixtureHandoffs), []);
  await ask();
  await page.evaluate(() => window.fixtureSwitchIdentity('fixture-b'));
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.fixtureHandoffs), []);
  await ask();
  // Even if an OAuth/UI callback has not fired, the live Firebase identity object
  // changes the confirmation context before dispatch.
  await page.evaluate(() => window.fixtureReplaceIdentitySilently());
  assert.equal(await dialog.count(), 1);
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.fixtureHandoffs), []);
  await page.evaluate(() => window.fixtureSwitchIdentity('fixture-a'));
  await ask();
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.waitForFunction(() => window.fixtureHandoffs.length === 1);
  assert.deepEqual(await page.evaluate(() => window.fixtureHandoffs), ['+15550000001']);
  console.log(JSON.stringify({ cancelledHandoffs: 0, identitySwitchDiscarded: true, staleIdentityDiscarded: true,
    keyboardCancellation: true, explicitlyConfirmedHandoffs: 1, realExternalCalls: 0 }));
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
