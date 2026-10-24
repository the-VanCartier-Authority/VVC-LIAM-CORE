// Real App + mocked boundaries. No actual Firebase, voice, push or provider calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH + '/index.mjs').href);

const stubs = {
  googleAuth: `
    const user = { uid: 'fixture-a', email: 'fixture@example.test', displayName: 'Fixture', getIdToken: async () => 'synthetic-id' };
    export const auth = { currentUser: user }, db = {}, WORKSPACE_SCOPES = [];
    export const initAuth = callback => { queueMicrotask(() => callback?.(user, 'synthetic-oauth')); return () => {}; };
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
  window.fixtureCalls = []; createRoot(document.getElementById('root')).render(React.createElement(App));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'isolated-boundaries', setup(b) {
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
    localStorage.setItem('vvc_liam_contacts', '[]'); localStorage.setItem('vvc_liam_chat_history', '[]');
  });
  await page.goto(base);
  await page.waitForTimeout(500);
  if (errors.length) throw new Error(JSON.stringify({ fixturePageErrors: errors }));
  const input = page.getByPlaceholder(/^Escribe o dicta un comando/);
  await input.waitFor({ timeout: 5000 }); await input.fill('fixture xyzzy texto'); await input.press('Enter');
  await page.getByText('fixture-visible-generation', { exact: true }).waitFor();
  const calls = await page.evaluate(() => window.fixtureCalls);
  console.log(JSON.stringify({ browser: browser.version(), paths: calls.map(call => call.path), errors, realExternalCalls: 0 }));
  assert.deepEqual(errors, []);
  assert.equal(calls.filter(call => call.path.startsWith('/api/chat/')).length, 1);
  assert.equal(calls.filter(call => call.path === '/api/vaos/dispatch').length, 0, 'chat must not create a second hidden generation');
  const geminiPage = await browser.newPage();
  geminiPage.on('pageerror', error => errors.push(error.message));
  await geminiPage.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await geminiPage.addInitScript(() => {
    localStorage.setItem('vvc_liam_model', 'google/gemini-2.5-flash');
    localStorage.setItem('vvc_secret_gemini_api_key', 'synthetic-gemini');
    for (const name of ['tasks','events','contacts','chat_history']) localStorage.setItem('vvc_liam_' + name, '[]');
  });
  await geminiPage.goto(base); await geminiPage.waitForTimeout(300);
  const geminiInput = geminiPage.getByPlaceholder(/^Escribe o dicta un comando/);
  await geminiInput.fill('fixture xyzzy texto'); await geminiInput.press('Enter');
  await geminiPage.getByText('fixture-visible-generation', { exact: true }).waitFor();
  const geminiCalls = await geminiPage.evaluate(() => window.fixtureCalls);
  const chat = geminiCalls.filter(call => call.path.startsWith('/api/chat/'));
  assert.equal(chat.length, 1); assert.equal(chat[0].path, '/api/chat/gemini');
  assert.equal(typeof chat[0].body.temperature, 'number'); assert.ok(chat[0].body.temperature >= 0 && chat[0].body.temperature <= 2);
  assert.ok(Number.isInteger(chat[0].body.max_tokens) && chat[0].body.max_tokens >= 1 && chat[0].body.max_tokens <= 4096);
  assert.equal(chat[0].body.messages[0].content, chat[0].body.systemInstruction);
  assert.equal(chat[0].body.messages.at(-1).content, chat[0].body.prompt);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ geminiRoute: chat[0].path, temperature: chat[0].body.temperature,
    max_tokens: chat[0].body.max_tokens, systemAndCurrentTurnConsistent: true, realProviderCalls: 0 }));
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
