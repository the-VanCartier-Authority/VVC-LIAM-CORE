import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './server-helper.mjs';

test('B01: every sensitive endpoint rejects missing and forged identity before its handler', async t => {
  const app = await startApp(); t.after(() => app.stop());
  for (const [method, path, body] of [
    ['GET', '/api/vaos/tasks'], ['GET', '/api/vaos/telemetry'], ['GET', '/api/vaos/task/missing'], ['GET', '/api/push/status'],
    ['POST', '/api/vaos/dispatch', {}], ['POST', '/api/chat/nvidia', {}], ['POST', '/api/chat/gemini', {}],
    ['POST', '/api/chat/custom', {}], ['POST', '/api/secrets/test', {}], ['POST', '/api/tts', { text: '' }],
    ['POST', '/api/push/subscribe', {}], ['POST', '/api/push/unsubscribe', {}], ['POST', '/api/push/send', {}],
  ]) {
    await t.test(`${method} ${path}`, async () => { for (const authorization of [undefined, 'Bearer forged-token']) {
      const response = await fetch(app.base + path, { method,
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.equal((await response.json()).code, 'AUTH_REQUIRED');
    } });
  }
});
