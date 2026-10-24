import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url, options) => {
  const request = new Request(url, options);
  const destination = new URL(request.url);
  if (destination.origin !== 'https://generativelanguage.googleapis.com') throw Error('Unexpected fixture destination');
  appendFileSync(process.env.F01_CAPTURE_FILE, JSON.stringify({
    origin: destination.origin, path: destination.pathname,
    serverKey: request.headers.get('x-goog-api-key') === 'synthetic-gemini-server',
    byok: request.headers.get('x-goog-api-key') === 'synthetic-gemini-byok',
  }) + '\n');
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'gemini fixture' }] } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
};
