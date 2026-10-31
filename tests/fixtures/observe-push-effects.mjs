// Test-only observation. Never send a real notification, even on the old code.
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const webpush = createRequire(import.meta.url)('web-push');
const record = event => appendFileSync(process.env.VVC_PUSH_EFFECTS_FILE, JSON.stringify({ event }) + '\n');
const generate = webpush.generateVAPIDKeys;
webpush.generateVAPIDKeys = (...args) => { record('generate'); return generate.apply(webpush, args); };
const configure = webpush.setVapidDetails;
webpush.setVapidDetails = (...args) => { record('configure'); return configure.apply(webpush, args); };
webpush.sendNotification = async () => { record('send'); return { statusCode: 201 }; };
for (const method of ['set', 'delete']) {
  const original = Map.prototype[method];
  Map.prototype[method] = function(key, ...args) {
    if (typeof key === 'string' && key.startsWith('https://push-disabled.invalid/')) record(method);
    return original.call(this, key, ...args);
  };
}
const schedule = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay, ...args) => {
  if (delay === 73) record('schedule');
  return schedule(callback, delay, ...args);
};
