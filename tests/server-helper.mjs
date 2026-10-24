import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

export async function startApp(extraEnv = {}, imports = []) {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [...imports.flatMap(p => ['--import', p]), 'server.ts'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port),
      NVIDIA_API_KEY: '', GEMINI_API_KEY: '', LLM_PROVIDERS_JSON: '[]', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) throw new Error(`App exited: ${output}`);
    try {
      if ((await fetch(base + '/api/config')).ok) return {
        base,
        async stop() { child.kill('SIGTERM'); await once(child, 'exit'); },
      };
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error('App startup timed out');
}

export function post(base, route, body) {
  return fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
}
