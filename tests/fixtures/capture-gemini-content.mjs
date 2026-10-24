import { appendFileSync } from 'node:fs';
globalThis.fetch = async (url, options) => {
  const request = new Request(url, options);
  if (new URL(request.url).origin !== 'https://generativelanguage.googleapis.com') throw Error('Unexpected fixture destination');
  appendFileSync(process.env.F01_CAPTURE_FILE, JSON.stringify(await request.json()) + '\n');
  return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: 'context fixture response' }] } }], modelVersion: 'gemini-fixture-reported' });
};
