import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identityFixture } from './identity-fixture.mjs';

const appTokens = new Map();

export async function startApp(extraEnv = {}, imports = []) {
  const identity = await identityFixture();
  const directory = await mkdtemp(join(tmpdir(), 'vvc-auth-fixture-'));
  const jwksPath = join(directory, 'jwks.json');
  await writeFile(jwksPath, JSON.stringify(identity.jwks));
  const token = await identity.token();
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [...[...imports, './tests/fixtures/mock-firebase-jwks.mjs'].flatMap(p => ['--import', p]), 'server.ts'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port),
      NVIDIA_API_KEY: '', GEMINI_API_KEY: '', LLM_PROVIDERS_JSON: '[]',
      FIREBASE_PROJECT_ID: identity.project, VVC_FIXTURE_JWKS_PATH: jwksPath, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) throw new Error(`App exited: ${output}`);
    try {
      if ((await fetch(base + '/api/config')).ok) { appTokens.set(base, token); return {
        base,
        token, identity, jwksPath,
        authHeaders: { Authorization: `Bearer ${token}` },
        async stop() { appTokens.delete(base); child.kill('SIGTERM'); await once(child, 'exit');
          await rm(directory, { recursive: true, force: true }); },
      }; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error('App startup timed out');
}

export function post(base, route, body) {
  return fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json',
    Authorization: `Bearer ${appTokens.get(base)}` },
    body: JSON.stringify(body) });
}
