// Browser coverage is a separate, explicit gate; npm test remains the Node suite.
import { readdir } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = (await readdir(new URL('../tests/', import.meta.url))).filter(name => name.endsWith('-browser.mjs')).sort();
if (!fixtures.length) throw new Error('NO_BROWSER_FIXTURES');
const executable = process.env.CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();
const fixtureTimeoutMs = 120000;
const killGraceMs = 500;

// Chromium itself may start a detached process group. Killing only the fixture
// PID (or only its group) can leave that browser and its pipes/ports alive.
function processTable() {
  if (process.platform === 'linux') {
    return readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => {
      try {
        const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
        const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
        return [{ pid: Number(name), parent: Number(fields[1]), identity: fields[19] }];
      } catch (error) {
        if (['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) return [];
        throw error;
      }
    });
  }
  // POSIX fallback; Windows uses taskkill's native process-tree operation below.
  return execFileSync('ps', ['-axo', 'pid=,ppid=,lstart='], { encoding: 'utf8', timeout: 1000 })
    .trim().split('\n').filter(Boolean).map(line => {
      const [pid, parent, ...started] = line.trim().split(/\s+/);
      return { pid: Number(pid), parent: Number(parent), identity: started.join(' ') };
    });
}

async function runFixture(fixture) {
  const child = spawn(process.execPath, [`tests/${fixture}`], { cwd: root, stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: { ...process.env, CHROMIUM_EXECUTABLE_PATH: executable,
      PLAYWRIGHT_CORE_PATH: fileURLToPath(new URL('../node_modules/playwright-core', import.meta.url)),
      GEMINI_API_KEY: '', NVIDIA_API_KEY: '', LLM_PROVIDERS_JSON: '[]' } });
  let code, signal, spawnError, failure, cleanupPromise, deadline;
  const exited = new Promise(resolve => {
    child.once('error', error => { spawnError = error; resolve(); });
    child.once('exit', (exitCode, exitSignal) => {
      code = exitCode; signal = exitSignal; clearTimeout(deadline); resolve();
    });
  });
  const closed = new Promise(resolve => child.once('close', resolve));
  let stopped;
  const stopFinished = new Promise(resolve => { stopped = resolve; });
  const known = new Map();

  function signalTree(killSignal) {
    if (!child.pid) return;
    if (process.platform === 'win32') {
      // /T includes descendants; /F is used only after the graceful interval.
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', ...(killSignal === 'SIGKILL' ? ['/F'] : [])],
          { stdio: 'ignore', timeout: 1000 });
      } catch (error) {
        if (child.exitCode === null && child.signalCode === null) throw error;
      }
      return;
    }
    let tableError;
    try {
      const table = processTable();
      // Retain identities across SIGTERM: children may be reparented when the
      // fixture exits. Do not target a later process that reused an observed PID.
      const roots = new Set(table.filter(p => known.get(p.pid) === p.identity).map(p => p.pid));
      if (child.exitCode === null && child.signalCode === null) roots.add(child.pid);
      let changed;
      do {
        changed = false;
        for (const p of table) if (roots.has(p.parent) && !roots.has(p.pid)) {
          roots.add(p.pid); changed = true;
        }
      } while (changed);
      for (const p of table) if (roots.has(p.pid)) known.set(p.pid, p.identity);
      for (const p of table.filter(p => known.get(p.pid) === p.identity).reverse()) {
        try { process.kill(p.pid, killSignal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    } catch (error) { tableError = error; }
    // Also covers ordinary descendants reparented before a normal fixture exit.
    try { process.kill(-child.pid, killSignal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    if (tableError) throw tableError;
  }

  function stop(reason) {
    failure ??= reason;
    if (!cleanupPromise) {
      cleanupPromise = (async () => {
        let error;
        try { signalTree('SIGTERM'); } catch (caught) { error = caught; }
        await delay(killGraceMs);
        try { signalTree('SIGKILL'); } catch (caught) { error ??= caught; }
        if (error) throw error;
      })();
      // Install the rejection handler immediately, including timeout/signal paths.
      cleanupPromise.then(stopped, stopped);
    }
    return cleanupPromise;
  }
  const handlers = new Map(['SIGINT', 'SIGTERM'].map(name => [name, () => {
    const error = new Error(`BROWSER_FIXTURE_INTERRUPTED: ${fixture} (${name})`);
    error.exitCode = name === 'SIGINT' ? 130 : 143;
    stop(error);
  }]));
  for (const [name, handler] of handlers) process.on(name, handler);
  deadline = setTimeout(() => stop(new Error(`BROWSER_FIXTURE_TIMEOUT: ${fixture} (${fixtureTimeoutMs}ms)`)), fixtureTimeoutMs);
  let closeDeadline;
  try {
    await Promise.race([exited, stopFinished]);
    await stop(); // Cleanup also runs after success/failure, before the next fixture.
    await Promise.race([closed, new Promise((_, reject) => {
      closeDeadline = setTimeout(() => reject(new Error(`BROWSER_FIXTURE_CLEANUP_FAILED: ${fixture}`)), 1000);
    })]);
    if (failure) throw failure;
    if (spawnError) throw spawnError;
    if (code !== 0 || signal) throw new Error(`BROWSER_FIXTURE_FAILED: ${fixture} (${code ?? signal})`);
  } finally {
    clearTimeout(deadline); clearTimeout(closeDeadline);
    for (const [name, handler] of handlers) process.off(name, handler);
    // If OS cleanup itself failed, report failure without an unreferenced child
    // handle silently keeping the CLI alive. The job remains the outer supervisor.
    child.unref();
  }
}

console.log(JSON.stringify({ gate: 'Chromium fixtures', fixtures, executable, node: process.version }));
try {
  for (const fixture of fixtures) {
    console.log(`Browser fixture: tests/${fixture}`);
    await runFixture(fixture);
  }
  console.log(JSON.stringify({ browserGate: 'PASS', fixturesExecuted: fixtures.length }));
} catch (error) {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
}
