import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startApp, post } from './server-helper.mjs';
const messages = [{ role: 'system', content: 'SYSTEM_FIXTURE' }, { role: 'user', content: 'FIRST_FIXTURE' },
  { role: 'assistant', content: 'SECOND_FIXTURE' }, { role: 'user', content: 'LAST_FIXTURE' }];
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'vvc-gemini-context-')), capture = join(directory, 'content.jsonl');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const app = await startApp({ GEMINI_API_KEY: 'synthetic-gemini-server', F01_CAPTURE_FILE: capture }, ['./tests/fixtures/capture-gemini-content.mjs']);
  t.after(() => app.stop());
  return { app, capture, async calls() { try { return (await readFile(capture, 'utf8')).trim().split('\n').map(JSON.parse); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } } };
}
const assertHistory = body => {
  assert.deepEqual(body.contents.map(content => ({ role: content.role, text: content.parts.map(part => part.text).join('') })),
    [{ role: 'user', text: 'FIRST_FIXTURE' }, { role: 'model', text: 'SECOND_FIXTURE' }, { role: 'user', text: 'LAST_FIXTURE' }]);
  assert.equal(body.systemInstruction.parts[0].text, 'SYSTEM_FIXTURE');
};
test('I11a: Gemini keeps all explicit turns and uses native systemInstruction', async t => {
  const fixture = await setup(t);
  assert.equal((await post(fixture.app.base, '/api/chat/gemini', { messages, model: 'gemini-2.5-flash' })).status, 200);
  const calls = await fixture.calls(); assert.equal(calls.length, 1); assertHistory(calls[0]);
});
test('I11a: bounded temperature and output token settings reach Gemini unchanged', async t => {
  const fixture = await setup(t);
  assert.equal((await post(fixture.app.base, '/api/chat/gemini', { prompt: 'LAST_FIXTURE', temperature: 0, max_tokens: 11 })).status, 200);
  const [body] = await fixture.calls(); assert.equal(body.generationConfig.temperature, 0); assert.equal(body.generationConfig.maxOutputTokens, 11);
});
test('I11a: explicitly requested Gemini fallback preserves the same conversation', async t => {
  const fixture = await setup(t);
  assert.equal((await post(fixture.app.base, '/api/chat/nvidia', { messages, model: 'meta/llama-3.2-11b-vision-instruct', fallback: 'gemini-flash' })).status, 200);
  const calls = await fixture.calls(); assert.equal(calls.length, 1); assertHistory(calls[0]);
});
test('I11a: contradictory prompt/system or invalid turn order cannot call the provider', async t => {
  const fixture = await setup(t);
  for (const body of [{ prompt: 'DIFFERENT', messages }, { systemInstruction: 'DIFFERENT', messages },
    { messages: [{ role: 'user', content: 'FIRST' }, { role: 'system', content: 'LATE_SYSTEM' }, { role: 'user', content: 'LAST' }] },
    { messages: [{ role: 'assistant', content: 'ORPHAN' }] }]) {
    assert.equal((await post(fixture.app.base, '/api/chat/gemini', body)).status, 400);
  }
  assert.deepEqual(await fixture.calls(), []);
});
