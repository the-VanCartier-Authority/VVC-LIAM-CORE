// Baseline regression only: intercept every fetch in the child process. No remote I/O.
import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url, options = {}) => {
  const payload = JSON.parse(options.body || '{}');
  appendFileSync(process.env.F01_CAPTURE_FILE, JSON.stringify({
    destination: String(url),
    serverCredential: options.headers?.Authorization === 'Bearer f01-synthetic-server',
    byokCredential: options.headers?.Authorization === 'Bearer f01-synthetic-byok',
    model: payload.model,
  }) + '\n');
  return new Response(JSON.stringify({ choices: [{ message: { content: 'fixture' } }] }), {
    status: payload.model === 'fixture/retry' ? 503 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
