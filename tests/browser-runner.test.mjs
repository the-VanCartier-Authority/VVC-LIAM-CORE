// Exercise the actual CLI against local synthetic fixtures, never a real provider.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const runner = new URL('../scripts/run-browser-fixtures.mjs', import.meta.url);
const childSource = `
  const { createServer } = require('node:net');
  process.on('SIGTERM', () => {}); process.on('SIGINT', () => {});
  const server = createServer();
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
`;
const fixtureSource = `
  import { spawn } from 'node:child_process';
  import { writeFileSync } from 'node:fs';
  process.on('SIGTERM', () => {}); process.on('SIGINT', () => {});
  const child = spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], {
    detached: process.env.FIXTURE_DETACHED === 'true',
    stdio: ['ignore', 'inherit', 'inherit', 'ipc']
  });
  child.once('message', ({ port }) => {
    writeFileSync(process.env.FIXTURE_STATE, JSON.stringify({ pid: process.pid, childPid: child.pid, port }));
    console.log('SYNTHETIC_FIXTURE_READY');
    if (process.env.FIXTURE_EXIT === 'true') process.exit(0);
  });
`;
// Manus: no inherited output pipe keeps the runner alive. The detached child
// survives a normal exit unless the supervisor retains OS-level ownership.
const orphanFixtureSource = `
  import { spawn } from 'node:child_process';
  import { writeFileSync } from 'node:fs';
  const child = spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], {
    detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  });
  child.once('message', ({ port }) => {
    writeFileSync(process.env.FIXTURE_STATE, JSON.stringify({ pid: process.pid, childPid: child.pid, port }));
    child.disconnect(); child.unref();
    console.log('SYNTHETIC_FIXTURE_READY');
    process.exit(0);
  });
`;

async function running(pid) {
  try {
    if (process.platform === 'linux') {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
      return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0] !== 'Z';
    }
    process.kill(pid, 0); return true;
  } catch (error) {
    if (['ENOENT', 'ESRCH'].includes(error.code)) return false;
    throw error;
  }
}

async function launch(t, { fixtures = { 'a-browser.mjs': fixtureSource }, env = {}, shorten = false,
  supervisorWithoutProof = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'g01-browser-runner-'));
  await mkdir(join(root, 'scripts')); await mkdir(join(root, 'tests'));
  await symlink(new URL('../node_modules', import.meta.url).pathname, join(root, 'node_modules'), 'dir');
  let source = await readFile(runner, 'utf8');
  if (shorten) {
    // Only shorten the production deadline. In particular, preserve the old spawn
    // implementation so the same regression can demonstrate its failure.
    assert.equal(source.match(/\b120000\b/g)?.length, 1);
    source = source.replace(/\b120000\b/, '1200');
  }
  await writeFile(join(root, 'scripts/run-browser-fixtures.mjs'), source);
  for (const [name, contents] of Object.entries(fixtures)) await writeFile(join(root, 'tests', name), contents);
  const statePath = join(root, 'state.json');
  if (supervisorWithoutProof) {
    await mkdir(join(root, 'bin'));
    await writeFile(join(root, 'bin/python3'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    env = { ...env, PATH: `${join(root, 'bin')}:${process.env.PATH}` };
  }
  const child = spawn(process.execPath, ['scripts/run-browser-fixtures.mjs'], {
    cwd: root, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FIXTURE_STATE: statePath, ...env }
  });
  let output = '', watchdogFired = false;
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, output, watchdogFired }));
  });
  // An independent watchdog bounds the *test*, including the deliberately broken
  // runner. It must never be mistaken for the runner's own successful cleanup.
  async function rescue() {
    let state;
    try { state = JSON.parse(await readFile(statePath, 'utf8')); } catch {}
    for (const pid of [state?.childPid, state?.pid, child.pid].filter(Boolean)) {
      try { if (process.platform !== 'win32') process.kill(-pid, 'SIGKILL'); } catch {}
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }
  const watchdog = setTimeout(() => { watchdogFired = true; void rescue(); }, 6500);
  t.after(async () => { clearTimeout(watchdog); await rescue(); await done; await rm(root, { recursive: true, force: true }); });
  async function ready() {
    for (let i = 0; i < 300; i++) {
      try { return JSON.parse(await readFile(statePath, 'utf8')); } catch {}
      await delay(10);
    }
    throw new Error(`Fixture did not start: ${output}`);
  }
  return { child, done, ready };
}

async function assertClean(state) {
  for (let i = 0; i < 100 && (await running(state.pid) || await running(state.childPid)); i++) await delay(10);
  assert.equal(await running(state.pid), false, 'fixture process must be stopped');
  assert.equal(await running(state.childPid), false, 'descendant process must be stopped');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(state.port, '127.0.0.1', resolve); });
  await new Promise(resolve => server.close(resolve));
}

test('browser deadline stops a SIGTERM-resistant fixture and detached child, releasing its port', async t => {
  const run = await launch(t, { shorten: true, env: { FIXTURE_DETACHED: 'true' } });
  const state = await run.ready();
  const result = await run.done;
  assert.equal(result.watchdogFired, false, 'runner must enforce its deadline without the test watchdog');
  assert.notEqual(result.code, 0);
  assert.match(result.output, /BROWSER_FIXTURE_TIMEOUT/);
  assert.doesNotMatch(result.output, /"browserGate":"PASS"/);
  await assertClean(state);
});

test('a successful fixture cannot leave an inherited child or pipe keeping the gate alive', async t => {
  const run = await launch(t, { env: { FIXTURE_EXIT: 'true' } });
  const state = await run.ready();
  const result = await run.done;
  assert.equal(result.watchdogFired, false);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /"browserGate":"PASS","fixturesExecuted":1/);
  await assertClean(state);
});

test('SIGINT and SIGTERM cancel the runner with nonzero status and clean its process tree', async t => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const run = await launch(t, { env: { FIXTURE_DETACHED: 'true' } });
    const state = await run.ready();
    run.child.kill(signal);
    const result = await run.done;
    assert.equal(result.watchdogFired, false);
    assert.equal(result.code, signal === 'SIGINT' ? 130 : 143);
    assert.match(result.output, /BROWSER_FIXTURE_INTERRUPTED/);
    assert.doesNotMatch(result.output, /"browserGate":"PASS"/);
    await assertClean(state);
  }
});

test('a failing fixture fails the gate and does not start later fixtures', async t => {
  const run = await launch(t, { fixtures: {
    'a-browser.mjs': 'process.exit(23);', 'b-browser.mjs': 'console.log("UNEXPECTED_LATER_FIXTURE");'
  } });
  const result = await run.done;
  assert.equal(result.watchdogFired, false); assert.notEqual(result.code, 0);
  assert.match(result.output, /BROWSER_FIXTURE_FAILED/);
  assert.doesNotMatch(result.output, /UNEXPECTED_LATER_FIXTURE|"browserGate":"PASS"/);
});

test('an empty browser fixture directory fails closed', async t => {
  const run = await launch(t, { fixtures: {} });
  const result = await run.done;
  assert.equal(result.watchdogFired, false); assert.notEqual(result.code, 0);
  assert.match(result.output, /NO_BROWSER_FIXTURES/);
});

test('Manus: normal exit cannot report PASS while a detached orphan holds a local port', async t => {
  const run = await launch(t, { fixtures: { 'a-browser.mjs': orphanFixtureSource } });
  const state = await run.ready();
  const result = await run.done;
  let parent;
  try {
    const stat = await readFile(`/proc/${state.childPid}/stat`, 'utf8');
    parent = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  } catch { parent = null; }
  const probe = createServer();
  const portState = await new Promise(resolve => {
    probe.once('error', error => resolve(error.code));
    probe.listen(state.port, '127.0.0.1', () => probe.close(() => resolve('available')));
  });
  console.log(JSON.stringify({ regression: 'Manus detached orphan after normal exit',
    runnerCode: result.code, runnerReportedPass: /"browserGate":"PASS"/.test(result.output),
    liveOrphan: await running(state.childPid), orphanParent: parent, localPort: portState }));
  assert.equal(result.watchdogFired, false);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /"browserGate":"PASS"/);
  await assertClean(state);
  assert.equal(portState, 'available');
  assert.match(result.output, /"cleanupVerified":true/);
});

test('a supervisor exiting zero without cleanup evidence cannot report PASS', async t => {
  const run = await launch(t, { supervisorWithoutProof: true,
    fixtures: { 'a-browser.mjs': 'console.log("UNEXPECTED_UNSUPERVISED_FIXTURE");' } });
  const result = await run.done;
  assert.equal(result.watchdogFired, false);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /BROWSER_FIXTURE_CLEANUP_FAILED/);
  assert.doesNotMatch(result.output, /"browserGate":"PASS"|UNEXPECTED_UNSUPERVISED_FIXTURE/);
});
