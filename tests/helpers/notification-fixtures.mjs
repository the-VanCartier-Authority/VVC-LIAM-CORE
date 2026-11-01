import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
export const root = process.env.VVC_NOTIFICATION_TEST_ROOT || fileURLToPath(new URL('../../', import.meta.url));
export function worker(file = 'public/sw.js') {
  const listeners = new Map(), pending = [], timers = [], deleted = [], replies = [];
  const counts = { show: 0, payload: 0, open: 0, claim: 0 };
  const context = vm.createContext({ console: { log() {}, warn() {} }, URL, Response, Promise,
    caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }),
      keys: async () => ['unrelated-user-cache', 'vvc-liam-core-cache-v1'],
      delete: async key => { deleted.push(key); return true; },
      match: async () => new Response('cached fixture') },
    fetch: async () => { throw Error('fixture offline'); },
    setTimeout: callback => { timers.push(callback); return timers.length; },
    self: { location: { origin: 'https://fixture.test' }, registration: { showNotification: async () => { counts.show++; } },
      skipWaiting: async () => {}, clients: { claim: async () => { counts.claim++; },
        matchAll: async () => [], openWindow: async () => { counts.open++; } },
      addEventListener: (type, callback) => { listeners.set(type, [...(listeners.get(type) || []), callback]); } }
  });
  context.importScripts = (...paths) => paths.forEach(path => vm.runInContext(readFileSync(root + 'public/' + path.split('/').at(-1), 'utf8'), context));
  vm.runInContext(readFileSync(root + file, 'utf8'), context, { filename: file });
  return { counts, timers, deleted, replies, async dispatch(type, data = {}, extra = {}) {
    const event = { data, ports: [{ postMessage: value => replies.push(value) }], action: '', notification: { close() {}, data: {} },
      waitUntil: promise => pending.push(promise), respondWith: promise => pending.push(promise),
      stopImmediatePropagation() {}, preventDefault() {}, ...extra };
    for (const callback of listeners.get(type) || []) callback(event);
    return Promise.all(pending.splice(0));
  } };
}
export async function client() {
  const counts = { permission: 0, subscribe: 0, unsubscribe: 0, show: 0, native: 0, messages: 0, fetch: 0, register: 0 };
  const storage = new Map([['vvc_liam_push_active', 'legacy-record'], ['unrelated-user-data', 'keep']]);
  const state = { existing: false, noWorker: false };
  const sub = { endpoint: 'https://synthetic.invalid/sub', toJSON: () => ({}), unsubscribe: async () => { counts.unsubscribe++; return true; } };
  const registration = { scope: 'https://fixture.test/', active: { postMessage: () => { counts.messages++; } },
    addEventListener() {}, update: async () => {}, showNotification: async () => { counts.show++; },
    pushManager: { getSubscription: async () => state.existing ? sub : null,
      subscribe: async () => { counts.subscribe++; return sub; } } };
  class Notification { static permission = 'granted'; static async requestPermission() { counts.permission++; return 'granted'; }
    constructor() { counts.native++; } }
  const sw = { register: async () => { counts.register++; return state.noWorker ? null : registration; },
    getRegistration: async () => state.noWorker ? null : registration,
    get ready() { return Promise.resolve(registration); },
    get controller() { return state.noWorker ? undefined : registration.active; }, addEventListener() {}, removeEventListener() {} };
  const sandbox = { console: { log() {}, warn() {}, error() {} }, URL, Response, Request, Headers, Buffer,
    setTimeout, clearTimeout, MessageChannel, Notification,
    navigator: { serviceWorker: sw, userAgent: 'synthetic desktop' },
    window: { Notification, PushManager: {}, atob, location: { origin: 'https://fixture.test' } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    __fixtureFetch: async url => { counts.fetch++; return String(url).includes('vapid-public-key')
      ? Response.json({ publicKey: Buffer.alloc(65, 1).toString('base64') })
      : Response.json({ success: false, code: 'PUSH_DISABLED' }, { status: 503 }); } };
  const policyExports = existsSync(root + 'src/shared/notificationPolicy.ts')
    ? `export * as lifecycle from './src/services/serviceWorkerLifecycle'; export * from './src/shared/notificationPolicy';` : '';
  const bundle = await build({ stdin: { contents: `export * from './src/services/pushNotificationService';
    ${policyExports}
    export { DeviceAdapter } from './src/core/adapters/DeviceAdapter';
    export { SettingsModal } from './src/components/SettingsModal';`, resolveDir: root },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'notification-test-boundaries', setup(b) {
      b.onResolve({ filter: /(?:^|\/)backendApi$/ }, () => ({ path: 'backend', namespace: 'fixture' }));
      b.onResolve({ filter: /\/utils\/speech$/ }, () => ({ path: 'speech', namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'backend'
        ? 'export const backendFetch = (...args) => globalThis.__fixtureFetch(...args);'
        : 'export const speakKokoro = () => {};' }));
    } }] });
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.matchMedia = () => ({ matches: false });
  const module = { exports: {} };
  const context = vm.createContext({ ...sandbox, module, exports: module.exports, require: createRequire(import.meta.url) });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return { service: module.exports, counts, state, storage, registration };
}
