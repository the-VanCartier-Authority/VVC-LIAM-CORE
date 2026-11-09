// Actual parser and App text/TTS dispatch. Synthetic Firebase/Firestore/backend/voice;
// no live accounts, providers or speech engines. Approved notification code is not mocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
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

const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client'; import App from './src/App';
  import { parseNaturalVoiceCommand, generateRTLiteResponse } from './src/utils/rtLiteEngine';
  window.fixtureCalls = []; window.fixtureSpeech = []; window.fixtureTones = [];
  window.messageFixture = { parseNaturalVoiceCommand, generateRTLiteResponse };
  createRoot(document.getElementById('root')).render(React.createElement(App));
`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  plugins: [{ name: 'synthetic-boundaries', setup(b) {
    b.onResolve({ filter: /\/(googleAuth|firestoreSyncService|backendApi|speech)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }] });
const server = createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><div id="root"></div><script type="module">' + bundle.outputFiles[0].text + '</script>');
});
let browser, cases = 0, externalCompleted = 0;
const violations = [];
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(),
    headless: true, proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1' },
    args: ['--no-sandbox', '--disable-background-networking'] });
  for (const identity of ['synthetic-a', 'synthetic-b']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
    context.on('requestfinished', req => { if (new URL(req.url()).origin !== base) externalCompleted++; });
    await context.addInitScript(() => {
      window.notificationEffects = { permission: 0, subscribe: 0, native: 0, show: 0, messages: 0 };
      const effects = window.notificationEffects, Original = window.Notification;
      window.Notification = class extends Original {
        constructor(...args) { effects.native++; super(...args); }
        static requestPermission() { effects.permission++; return Promise.resolve('granted'); }
        static get permission() { return 'granted'; }
      };
      PushManager.prototype.subscribe = async () => { effects.subscribe++; return {}; };
      ServiceWorkerRegistration.prototype.showNotification = async () => { effects.show++; };
      const post = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function(data, ...rest) {
        if (['SHOW_BACKGROUND_NOTIFICATION', 'SCHEDULE_BACKGROUND_NOTIFICATION'].includes(data?.type)) effects.messages++;
        return post.call(this, data, ...rest);
      };
      localStorage.setItem('vvc_liam_model', 'rt-lite-local');
      for (const name of ['tasks','events','contacts','chat_history']) localStorage.setItem('vvc_liam_' + name, '[]');
      localStorage.setItem('vvc_liam_push_active', 'legacy-record');
      localStorage.setItem('vvc_liam_third_party_webhook', '');
    });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(base + '/?identity=' + identity);
    const input = page.getByPlaceholder(/^Escribe o dicta un comando/); await input.waitFor();
    for (const [command, title, priority, recurrence, time] of [
      ['Crear tarea urgente revisar informe a las 14:35 diario', 'revisar informe', 'critica', 'daily', '14:35'],
      ['Crear tarea prioridad baja respaldo local a las 16:40 semanal', 'respaldo local', 'baja', 'weekly', '16:40'],
    ]) {
      await input.fill(command); await input.press('Enter');
      await page.waitForFunction(expectedTitle => JSON.parse(localStorage.getItem('vvc_liam_tasks') || '[]').some(t => t.title === expectedTitle), title);
      const state = await page.evaluate(({ command, title }) => {
        const parsed = window.messageFixture.parseNaturalVoiceCommand(command, {}, [], [], []);
        const task = JSON.parse(localStorage.getItem('vvc_liam_tasks')).find(t => t.title === title);
        const answer = JSON.parse(localStorage.getItem('vvc_liam_chat_history')).filter(m => m.sender === 'assistant').at(-1);
        return { parsed, task, answer, voice: window.fixtureSpeech.at(-1), effects: window.notificationEffects, calls: window.fixtureCalls };
      }, { command, title });
      assert.equal(state.answer.text, state.parsed.spokenResponse);
      assert.equal(state.voice, state.parsed.spokenResponse);
      await page.getByText(state.answer.text, { exact: true }).waitFor();
      assert.deepEqual({ title: state.task.title, priority: state.task.priority, recurrence: state.task.recurrence,
        timeDue: state.task.timeDue, isCompleted: state.task.isCompleted }, { title, priority, recurrence, timeDue: time, isCompleted: false });
      for (const [key, value] of Object.entries(state.parsed.newTask)) assert.deepEqual(state.task[key], value, 'persisted field ' + key);
      assert.ok(state.task.id); assert.ok(state.task.createdAt); assert.ok(state.task.updatedAt);
      assert.deepEqual(state.effects, { permission: 0, subscribe: 0, native: 0, show: 0, messages: 0 });
      assert.equal(state.calls.filter(x => x.path.startsWith('/api/push/')).length, 0);
      const truthful = !/Notificación en tiempo real|sincronización listas/i.test(state.answer.text) && /notificaciones push y locales están deshabilitadas/i.test(state.answer.text);
      console.log(JSON.stringify({ identity, case: 'task text/voice', priority, truthful, response: state.answer.text, effects: state.effects }));
      if (!truthful) violations.push(identity + ': ' + priority + ' task text/voice promises unavailable notifications or sync');
      cases++;
    }
    await input.fill('comandos'); await input.press('Enter');
    await page.waitForFunction(() => window.fixtureSpeech.at(-1)?.includes('Comandos disponibles'));
    const help = await page.evaluate(() => ({ generated: window.messageFixture.generateRTLiteResponse('comandos'),
      answer: JSON.parse(localStorage.getItem('vvc_liam_chat_history')).filter(m => m.sender === 'assistant').at(-1).text,
      voice: window.fixtureSpeech.at(-1), effects: window.notificationEffects,
      legacy: localStorage.getItem('vvc_liam_push_active'), tasks: JSON.parse(localStorage.getItem('vvc_liam_tasks')).length }));
    assert.equal(help.answer, help.generated); assert.equal(help.voice, help.generated);
    await page.getByText(help.answer, { exact: true }).waitFor();
    const truthful = !/probar notificación push/i.test(help.answer) && /notificaciones push y locales están deshabilitadas/i.test(help.answer);
    console.log(JSON.stringify({ identity, case: 'help text/voice', truthful, offersPushTest: /probar notificación push/i.test(help.answer) }));
    if (!truthful) violations.push(identity + ': help text/voice offers disabled push test');
    assert.deepEqual(help.effects, { permission: 0, subscribe: 0, native: 0, show: 0, messages: 0 });
    assert.equal(help.tasks, 2); assert.equal(help.legacy, 'legacy-record'); assert.deepEqual(pageErrors, []); cases++;
    await context.close();
  }
  assert.equal(externalCompleted, 0);
  assert.deepEqual(violations, []);
  console.log(JSON.stringify({ fixture: 'G02 truthful task/help text and voice', result: 'PASS', cases, identities: 2,
    browser: browser.version(), realExternalCalls: externalCompleted, realSpeechProviderCalls: 0 }));
} finally {
  await browser?.close();
  if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
