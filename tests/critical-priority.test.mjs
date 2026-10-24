import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VaosPolicyEngine } from '../src/server/vaosOrchestrator.ts';
import { startApp, post } from './server-helper.mjs';

test('I01: a client cannot turn critical or operational work into a fast path', () => {
  for (const command of ['abrir bóveda', 'rotar clave', 'formatear disco', 'restablecer sistema', 'análisis OSINT']) {
    const policy = VaosPolicyEngine.evaluate(command, 'fixture-agent', 'P2_LOW');
    assert.equal(policy.approved, false, command);
    assert.equal(policy.priority, 'P0_CRITICAL'); assert.equal(policy.route, 'ASYNC_PATH');
  }
  const operational = VaosPolicyEngine.evaluate('enviar correo', undefined, 'P2_LOW');
  assert.equal(operational.approved, false); assert.equal(operational.priority, 'P1_HIGH');
});

test('I01: invalid priority values never become policy decisions', () => {
  for (const value of [null, '', 0, false, [], {}, 'P0', 'P3_LOW', 'p0_critical']) {
    const policy = VaosPolicyEngine.evaluate('consulta informativa', undefined, value);
    assert.equal(policy.approved, false, JSON.stringify(value));
    assert.equal(policy.code, 'INVALID_PRIORITY');
  }
});

test('I01: HTTP rejects downgrade and invalid values before allocating a task', async t => {
  const app = await startApp(); t.after(() => app.stop());
  const before = await (await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders })).json();
  const downgrade = await post(app.base, '/api/vaos/dispatch', { command: 'abrir bóveda', forcePriority: 'P2_LOW' });
  assert.equal(downgrade.status, 403);
  const denied = await downgrade.json();
  assert.equal(denied.policyApproved, false); assert.equal(denied.priority, 'P0_CRITICAL');
  assert.equal(denied.route, 'ASYNC_PATH'); assert.equal(denied.code, 'PRIORITY_DOWNGRADE');
  for (const forcePriority of [null, '', 'P0', {}, 1]) {
    const result = await post(app.base, '/api/vaos/dispatch', { command: 'consulta informativa', forcePriority });
    assert.equal(result.status, 400); assert.equal((await result.json()).code, 'INVALID_PRIORITY');
  }
  const after = await (await fetch(app.base + '/api/vaos/tasks', { headers: app.authHeaders })).json();
  assert.deepEqual(after, before);
});
