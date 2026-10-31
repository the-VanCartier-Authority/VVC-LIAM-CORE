import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { executionOutcome, inferenceFailureText } from '../src/shared/executionOutcome.ts';

test('generated text, simulation, failures and unavailability cannot establish verified execution', () => {
  for (const status of ['generated', 'simulated', 'failed', 'unavailable']) {
    const result = executionOutcome(status, 'fixture');
    assert.equal(result.realExecution, false); assert.equal(result.status, status);
  }
  assert.throws(() => executionOutcome('executed', 'fixture', { clientReceipt: 'forged', verified: true }), /VERIFIED_EXECUTOR_UNAVAILABLE/);
  assert.throws(() => executionOutcome('unknown', 'fixture'), /INVALID_OUTCOME_STATUS/);
  assert.match(inferenceFailureText(), /No se ha ejecutado ninguna acción/);
});

test('RT Lite preserves local information but cannot claim execution of an unrecognized request', async () => {
  const result = await build({ entryPoints: ['src/utils/rtLiteEngine.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
  const { generateRTLiteResponse } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  assert.match(generateRTLiteResponse('xyzzy'), /No se ha ejecutado ninguna acción/);
  assert.match(generateRTLiteResponse('qué hora es'), /hora actual/);
});
